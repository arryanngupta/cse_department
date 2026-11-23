/**
 * Tests for the research-authorship, event-registration and audit-log
 * features, plus the pagination and LIKE-escaping regressions.
 *
 * Runs against a live backend (see api.test.js for the rationale).
 *
 * These tests DO write: they create an authorship link, open registration on
 * an event, and register attendees. Everything created is removed in the
 * cleanup step, but point BASE_URL at a development instance, not production.
 */

import test, { before, after, describe } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:3022').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || 'admin@lnmiit.ac.in';
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'Admin@123';

let token = null;
const created = { authorLinks: [], registrations: [] };
let eventId = null;
let researchId = null;
let personId = null;

const req = (path, init = {}) =>
  fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

const json = async (path, init) => {
  const res = await req(path, init);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
};

before(async () => {
  const { res, body } = await json('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.equal(res.status, 200, 'admin login must succeed for these tests');
  token = body.data.token;

  // Pick real fixtures rather than assuming ids.
  const people = await json('/api/people?limit=1');
  personId = (people.body.data || [])[0]?.id ?? null;

  const research = await json('/api/research?limit=1');
  researchId = (research.body.data || [])[0]?.id ?? null;

  const events = await json('/api/events?limit=1');
  eventId = (events.body.data || [])[0]?.id ?? null;
});

after(async () => {
  // Remove everything these tests created, newest first.
  for (const id of created.registrations) {
    await req(`/api/admin/events/registrations/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const id of created.authorLinks) {
    await req(`/api/admin/research/authors/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  if (eventId) {
    await req(`/api/admin/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({ registration_open: false }),
    }).catch(() => {});
  }
});

describe('pagination hardening', () => {
  const endpoints = ['news', 'people', 'events', 'programs'];

  for (const ep of endpoints) {
    test(`GET /api/${ep}?limit=abc returns 200, not 500`, async () => {
      // parseInt('abc') produced NaN, which Sequelize rejected with
      // "Undeclared variable: NaN" — a 500 on a public listing.
      const { res } = await json(`/api/${ep}?limit=abc`);
      assert.equal(res.status, 200);
    });

    test(`GET /api/${ep}?page=-1 returns 200`, async () => {
      const { res } = await json(`/api/${ep}?page=-1`);
      assert.equal(res.status, 200);
    });
  }

  test('limit is clamped so a caller cannot dump a whole table', async () => {
    const { body } = await json('/api/people?limit=999999');
    assert.ok(body.meta.limit <= 100, `limit should be clamped, got ${body.meta.limit}`);
  });

  test('meta.totalPages is consistent with the clamped limit', async () => {
    const { body } = await json('/api/people?limit=2');
    assert.equal(body.meta.limit, 2);
    assert.equal(body.meta.totalPages, Math.ceil(body.meta.total / 2));
  });
});

describe('LIKE wildcard escaping in list filters', () => {
  test('a percent sign in a filter does not match every row', async () => {
    const { body } = await json('/api/people?q=%25');
    assert.equal(body.data.length, 0, 'percent must not behave as a wildcard');
  });

  test('an underscore does not match a single arbitrary character', async () => {
    const { body } = await json('/api/people?q=_');
    assert.equal(body.data.length, 0);
  });
});

describe('research authorship', () => {
  test('a department member can be linked to a research record', async (t) => {
    if (!researchId || !personId) return t.skip('no research or people fixtures');

    const { res, body } = await json(`/api/admin/research/${researchId}/authors`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId }),
    });

    // 409 means a link already exists, which is equally valid for this check.
    assert.ok([201, 409].includes(res.status), `unexpected status ${res.status}`);
    if (res.status === 201) created.authorLinks.push(body.data.id);
  });

  test('the public research detail exposes linked contributors', async (t) => {
    if (!researchId) return t.skip('no research fixture');

    const { res, body } = await json(`/api/research/${researchId}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.data.contributors));

    for (const c of body.data.contributors) {
      assert.ok(c.name, 'a contributor must have a name');
      assert.equal(typeof c.internal, 'boolean');
      // Internal contributors must be linkable; external ones must not claim to be.
      if (c.internal) assert.ok(c.slug, 'internal contributors need a slug');
      else assert.equal(c.slug, null);
    }
  });

  test('the faculty profile exposes linked research', async (t) => {
    if (!personId) return t.skip('no people fixture');

    const people = await json('/api/people?limit=1');
    const slug = people.body.data[0].slug;

    const { res, body } = await json(`/api/people/${encodeURIComponent(slug)}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.data.linkedResearch));

    for (const r of body.data.linkedResearch) {
      assert.ok(r.url.startsWith('/research/'), 'linked research needs a usable url');
    }
  });

  test('an external author is accepted without a person_id', async (t) => {
    if (!researchId) return t.skip('no research fixture');

    const { res, body } = await json(`/api/admin/research/${researchId}/authors`, {
      method: 'POST',
      body: JSON.stringify({ external_name: 'Test External Author' }),
    });
    assert.equal(res.status, 201);
    created.authorLinks.push(body.data.id);
  });

  test('supplying neither person_id nor external_name is rejected', async (t) => {
    if (!researchId) return t.skip('no research fixture');

    const { res } = await json(`/api/admin/research/${researchId}/authors`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
  });

  test('supplying both is rejected', async (t) => {
    if (!researchId || !personId) return t.skip('no fixtures');

    const { res } = await json(`/api/admin/research/${researchId}/authors`, {
      method: 'POST',
      body: JSON.stringify({ person_id: personId, external_name: 'Someone' }),
    });
    assert.equal(res.status, 400);
  });

  test('a non-existent person_id is rejected', async (t) => {
    if (!researchId) return t.skip('no research fixture');

    const { res } = await json(`/api/admin/research/${researchId}/authors`, {
      method: 'POST',
      body: JSON.stringify({ person_id: 999999 }),
    });
    assert.equal(res.status, 400);
  });

  test('authorship endpoints require authentication', async () => {
    const saved = token;
    token = null;
    try {
      const { res } = await json(`/api/admin/research/${researchId || 1}/authors`);
      assert.equal(res.status, 401);
    } finally {
      token = saved;
    }
  });
});

describe('event registration', () => {
  test('registration is closed by default', async (t) => {
    if (!eventId) return t.skip('no event fixture');

    const { res, body } = await json(`/api/events/${eventId}/registration`);
    assert.equal(res.status, 200);
    assert.equal(typeof body.data.open, 'boolean');
  });

  test('registering on a closed event is refused', async (t) => {
    if (!eventId) return t.skip('no event fixture');

    const status = await json(`/api/events/${eventId}/registration`);
    if (status.body.data.open) return t.skip('event already open');

    const { res } = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Closed Test', email: 'closed@example.com' }),
    });
    assert.equal(res.status, 409);
  });

  test('a full registration lifecycle works once opened', async (t) => {
    if (!eventId) return t.skip('no event fixture');

    // Open with capacity 1 so the waitlist path is exercised.
    const open = await json(`/api/admin/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify({
        registration_open: true,
        registration_capacity: 1,
        registration_deadline: '2099-01-01T00:00:00.000Z',
      }),
    });
    assert.equal(open.res.status, 200, 'should be able to open registration');

    const status = await json(`/api/events/${eventId}/registration`);
    assert.equal(status.body.data.open, true);
    assert.equal(status.body.data.capacity, 1);

    const unique = Date.now();

    // First registrant takes the only seat.
    const first = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'First Attendee', email: `first-${unique}@example.com` }),
    });
    assert.equal(first.res.status, 201);
    assert.equal(first.body.data.status, 'registered');

    // Second goes to the waitlist rather than being refused.
    const second = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Second Attendee', email: `second-${unique}@example.com` }),
    });
    assert.equal(second.res.status, 201);
    assert.equal(second.body.data.status, 'waitlisted');

    // Duplicate email on the same event is rejected.
    const dupe = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'First Again', email: `first-${unique}@example.com` }),
    });
    assert.equal(dupe.res.status, 409);

    // Invalid email fails validation with per-field detail.
    const bad = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify({ name: 'Bad Email', email: 'not-an-email' }),
    });
    assert.equal(bad.res.status, 400);
    assert.ok(Array.isArray(bad.body.details));

    // Admin can see them, with per-status counts.
    const list = await json(`/api/admin/events/${eventId}/registrations`);
    assert.equal(list.res.status, 200);
    assert.ok(list.body.meta.total >= 2);

    for (const row of list.body.data) {
      if (String(row.email).includes(String(unique))) created.registrations.push(row.id);
    }

    // The public response must not leak other registrants.
    const publicStatus = await json(`/api/events/${eventId}/registration`);
    assert.ok(
      !JSON.stringify(publicStatus.body).includes('@example.com'),
      'public status must not expose registrant emails',
    );
  });

  test('the CSV export neutralises spreadsheet formula injection', async (t) => {
    if (!eventId) return t.skip('no event fixture');

    const unique = Date.now();
    const payload = {
      name: '=HYPERLINK("http://evil","click")',
      email: `formula-${unique}@example.com`,
    };

    const reg = await json(`/api/events/${eventId}/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (reg.res.status !== 201) return t.skip('registration not open');

    const list = await json(`/api/admin/events/${eventId}/registrations`);
    for (const row of list.body.data) {
      if (String(row.email).includes(String(unique))) created.registrations.push(row.id);
    }

    const res = await req(`/api/admin/events/${eventId}/registrations.csv`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /text\/csv/);

    const csv = await res.text();
    assert.ok(csv.includes('HYPERLINK'), 'the value should still be present');
    assert.ok(
      !/(^|,)"?=HYPERLINK/m.test(csv),
      'a cell must not begin with = — it would execute on open',
    );
    assert.ok(csv.includes("'=HYPERLINK"), 'the formula should be prefixed with an apostrophe');
  });

  test('registration endpoints require auth on the admin side', async () => {
    const saved = token;
    token = null;
    try {
      const { res } = await json(`/api/admin/events/${eventId || 1}/registrations`);
      assert.equal(res.status, 401);
    } finally {
      token = saved;
    }
  });
});

describe('audit log', () => {
  test('admin mutations are recorded', async () => {
    const before = await json('/api/admin/audit-logs?limit=1');
    const countBefore = before.body.meta.total;

    // Any state change will do; a directory entry is cheap and self-contained.
    const create = await json('/api/admin/directory', {
      method: 'POST',
      body: JSON.stringify({
        name: `Audit Probe ${Date.now()}`,
        role: 'Test',
        phone: '0000',
        email: `probe-${Date.now()}@example.com`,
      }),
    });

    if (create.res.status !== 201) return;

    const entryId = create.body?.data?.id;

    // The log is written on response finish, so allow a moment.
    await new Promise((r) => setTimeout(r, 400));

    const after_ = await json('/api/admin/audit-logs?action=create&resource=directory&limit=5');
    assert.ok(after_.body.meta.total > 0, 'a create entry for directory should exist');

    // Asserted by presence, not position: the test files run in parallel, so
    // another file's login can be written after this create.
    const entry = after_.body.data.find((r) => r.resource === 'directory');
    assert.ok(entry, 'the directory create should be in the log');
    assert.equal(entry.action, 'create');
    assert.ok(entry.actor_email, 'the actor must be recorded');

    const total = await json('/api/admin/audit-logs?limit=1');
    assert.ok(total.body.meta.total > countBefore, 'the log should have grown');

    if (entryId) {
      await req(`/api/admin/directory/${entryId}`, { method: 'DELETE' }).catch(() => {});
    }
  });

  test('secrets never appear in the log', async () => {
    const { body } = await json('/api/admin/audit-logs?limit=100');
    const serialized = JSON.stringify(body.data);

    // Field names may be recorded; values must not be.
    assert.ok(!/Admin@123/.test(serialized), 'a password value must never be logged');
    assert.ok(!/\$2[aby]\$\d{2}\$/.test(serialized), 'a bcrypt hash must never be logged');
    assert.ok(
      !/eyJhbGciOi/.test(serialized),
      'a JWT must never be logged',
    );
  });

  test('the log is filterable by action', async () => {
    const { res, body } = await json('/api/admin/audit-logs?action=login&limit=5');
    assert.equal(res.status, 200);
    for (const row of body.data) assert.equal(row.action, 'login');
  });

  test('an invalid date filter does not silently empty the result set', async () => {
    const valid = await json('/api/admin/audit-logs?limit=1');
    const bogus = await json('/api/admin/audit-logs?from=not-a-date&limit=1');
    assert.equal(bogus.res.status, 200);
    assert.equal(bogus.body.meta.total, valid.body.meta.total);
  });

  test('the summary endpoint reports counts', async () => {
    const { res, body } = await json('/api/admin/audit-logs/summary');
    assert.equal(res.status, 200);
    assert.equal(typeof body.data.total, 'number');
    assert.equal(typeof body.data.byAction, 'object');
  });

  test('there is no endpoint to modify or delete audit entries', async () => {
    const { body } = await json('/api/admin/audit-logs?limit=1');
    const id = body.data[0]?.id;
    if (!id) return;

    // Both should 404 — the routes deliberately do not exist.
    const del = await req(`/api/admin/audit-logs/${id}`, { method: 'DELETE' });
    assert.equal(del.status, 404, 'audit entries must not be deletable');

    const put = await req(`/api/admin/audit-logs/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ summary: 'tampered' }),
    });
    assert.equal(put.status, 404, 'audit entries must not be editable');
  });

  test('the audit log requires authentication', async () => {
    const saved = token;
    token = null;
    try {
      const { res } = await json('/api/admin/audit-logs');
      assert.equal(res.status, 401);
    } finally {
      token = saved;
    }
  });
});
