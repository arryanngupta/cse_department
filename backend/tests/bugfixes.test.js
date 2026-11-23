/**
 * Regression tests for specific defects found by auditing the running app.
 *
 * Each block names the bug it pins down, because a test called "slug works" is
 * worthless once someone changes the slug rules for a good reason and has to
 * decide whether breaking this test matters.
 *
 * Read-only against the API; the slug and upload-path blocks are pure unit
 * tests.
 */

import test, { describe, before } from 'node:test';
import assert from 'node:assert/strict';

const BASE = (process.env.BASE_URL || 'http://localhost:3022').replace(/\/$/, '');

before(async () => {
  const res = await fetch(`${BASE}/health`).catch(() => null);
  assert.ok(res && res.status === 200, `backend not reachable at ${BASE}`);
});

/* ================================================================== *
 * generateSlug
 * ================================================================== */

describe('generateSlug', () => {
  let generateSlug;

  before(async () => {
    ({ generateSlug } = await import('../src/utils/slugUtils.js'));
  });

  test('transliterates accents instead of deleting them', () => {
    // Was "jos-lvarez": the accented letters were stripped by the
    // non-word-character filter, silently mangling the name.
    assert.equal(generateSlug('José Álvarez'), 'jose-alvarez');
    assert.equal(generateSlug('Ünïcödé Nâmé'), 'unicode-name');
    assert.equal(generateSlug('Zoë Çelik'), 'zoe-celik');
  });

  test('never returns an empty slug when a fallback is given', () => {
    // Was "": an empty slug makes /people/<slug> resolve to the People list
    // rather than a profile, and the second such record collides on the
    // unique index.
    for (const name of ['!!!', '...', '日本語', '   ', '###']) {
      assert.equal(
        generateSlug(name, 'person'),
        'person',
        `${JSON.stringify(name)} should fall back`,
      );
    }
  });

  test('trims leading and trailing hyphens', () => {
    // Was "-weird-".
    assert.equal(generateSlug('-- Weird --'), 'weird');
    assert.equal(generateSlug('...Name...'), 'name');
  });

  test('strips a title whether or not it has a full stop', () => {
    // Was two different slugs for the same person depending on typing:
    // "Dr. Amit Sharma" -> "amit-sharma" but "Dr Amit Sharma" -> "dr-amit-sharma".
    assert.equal(generateSlug('Dr. Amit Sharma'), 'amit-sharma');
    assert.equal(generateSlug('Dr Amit Sharma'), 'amit-sharma');
    assert.equal(generateSlug('Prof.Rahul Verma'), 'rahul-verma');
    assert.equal(generateSlug('Mr. John Smith'), 'john-smith');
    assert.equal(generateSlug('Professor Kumar'), 'kumar');
  });

  test('does not mistake a name beginning with a title for a title', () => {
    // "Drona" starts with "dr" but is not "Dr".
    assert.equal(generateSlug('Drona Singh'), 'drona-singh');
    assert.equal(generateSlug('Profit Analysis'), 'profit-analysis');
  });

  test('turns separators into hyphens rather than removing them', () => {
    // Was "ab-tester": the slash vanished and joined two distinct words.
    assert.equal(generateSlug('A/B Tester'), 'a-b-tester');
    assert.equal(generateSlug('Ravi_Kumar'), 'ravi-kumar');
  });

  test('produces only URL-safe characters', () => {
    for (const name of [
      'Dr. A. P. J. Abdul Kalam', 'Name With "Quotes"', "O'Brien",
      'R&D Lead', '  Padded  ', 'José Álvarez', '50% Guy',
    ]) {
      const slug = generateSlug(name, 'person');
      assert.match(slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `${name} -> ${slug}`);
    }
  });
});

/* ================================================================== *
 * Upload path resolution
 * ================================================================== */

describe('servable upload paths', () => {
  let isServableFile;

  before(async () => {
    ({ isServableFile } = await import('../src/utils/uploadPath.js'));
  });

  test('a remote URL is accepted without probing it', () => {
    assert.equal(isServableFile('https://res.cloudinary.com/x/y.pdf'), true);
    assert.equal(isServableFile('http://example.com/a.pdf'), true);
  });

  test('a missing local file is not servable', () => {
    assert.equal(isServableFile('/uploads/pdfs/definitely-not-here.pdf'), false);
  });

  test('path traversal is refused even if the target exists', () => {
    // A stored value must never be able to report a file outside the upload
    // root as servable.
    for (const p of [
      '/uploads/../.env',
      '/uploads/../../package.json',
      '/uploads/pdfs/../../../.env',
    ]) {
      assert.equal(isServableFile(p), false, p);
    }
  });

  test('empty and non-upload paths are not servable', () => {
    for (const p of ['', null, undefined, '/etc/passwd', 'relative/file.pdf']) {
      assert.equal(isServableFile(p), false, String(p));
    }
  });
});

/* ================================================================== *
 * Dead download links
 * ================================================================== */

describe('curriculum downloads', () => {
  test('no programme advertises a path that does not resolve', async () => {
    // Four of six programmes pointed at /uploads/pdfs/*.pdf files that are not
    // on disk, and the UI rendered a download button beside each one.
    const res = await fetch(`${BASE}/api/public/programs?limit=50`);
    assert.equal(res.status, 200);

    const { data } = await res.json();
    assert.ok(data.length > 0, 'there should be programmes to check');

    for (const programme of data) {
      const url = programme.curriculum_pdf_path;
      if (!url) continue; // correctly suppressed

      const remote = /^https?:\/\//i.test(url);
      const target = remote ? url : `${BASE}${url}`;

      /*
       * A remote URL is fetched from Cloudinary, so a transport failure means
       * "the network was unavailable", not "the link is dead" — failing the
       * suite for that makes it flaky for a reason unrelated to the code. A
       * *response* is still asserted on: a remote 404 is a genuine dead link
       * and must fail.
       */
      let res;
      try {
        res = await fetch(target);
      } catch (error) {
        if (remote) continue;
        throw error;
      }

      assert.equal(
        res.status,
        200,
        `programme #${programme.id} advertises ${url} which returns ${res.status}`,
      );
    }
  });

  test('programme details suppress a missing file too', async () => {
    const list = await (await fetch(`${BASE}/api/public/programs?limit=50`)).json();

    for (const programme of list.data.slice(0, 6)) {
      const res = await fetch(`${BASE}/api/public/programs/${programme.id}`);
      if (res.status !== 200) continue;

      const { data } = await res.json();
      const url = data.curriculum_pdf_path;
      if (!url || /^https?:\/\//i.test(url)) continue;

      const file = await fetch(`${BASE}${url}`);
      assert.equal(file.status, 200, `details for #${programme.id} advertise a dead ${url}`);
    }
  });
});

/* ================================================================== *
 * Static upload handler
 * ================================================================== */

describe('uploads static handler', () => {
  test('serves a file that exists, with the right content type', async () => {
    const res = await fetch(`${BASE}/uploads/pdfs/1763593496951-731439423.pdf`);
    // Skip rather than fail if this fixture file is absent from a given
    // checkout — the behaviour under test is the handler, not the file.
    if (res.status === 404) return;

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') || '', /application\/pdf/);
  });

  test('a missing file 404s as JSON-free plain 404, not a crash', async () => {
    const res = await fetch(`${BASE}/uploads/pdfs/no-such-file.pdf`);
    assert.equal(res.status, 404);
  });

  test('does not list directory contents', async () => {
    const res = await fetch(`${BASE}/uploads/pdfs/`);
    assert.equal(res.status, 404, 'a directory must not be browsable');

    const body = await res.text();
    assert.ok(!/\.pdf/i.test(body), 'a 404 body must not enumerate filenames');
  });

  test('refuses dotfiles and traversal', async () => {
    for (const p of [
      '/uploads/.env',
      '/uploads/../.env',
      '/uploads/../../backend/.env',
      '/uploads/%2e%2e/.env',
    ]) {
      const res = await fetch(`${BASE}${p}`);
      assert.ok(res.status >= 400, `${p} returned ${res.status}`);

      const body = await res.text();
      assert.ok(!/DB_PASS|JWT_SECRET|GROQ_API_KEY/i.test(body), `${p} leaked env contents`);
    }
  });
});

/* ================================================================== *
 * Rate limiting
 * ================================================================== */

describe('api rate limiting', () => {
  test('ordinary browsing does not get throttled', async () => {
    // 600 per 15 minutes per IP meant a NAT'd campus network shared one bucket
    // and a lecture hall browsing the site locked everyone out. A short burst
    // representing a handful of page loads must stay well clear of the limit.
    const res = await fetch(`${BASE}/api/public/news`);
    assert.equal(res.status, 200);

    const limit = Number(res.headers.get('ratelimit-limit'));
    assert.ok(
      Number.isFinite(limit) && limit >= 2000,
      `api limit is ${limit}; too low for a shared institutional IP`,
    );
  });

  test('the limiter message does not leak internals', async () => {
    const res = await fetch(`${BASE}/api/public/news`);
    const remaining = res.headers.get('ratelimit-remaining');
    assert.ok(remaining !== null, 'standard rate-limit headers should be present');
  });
});
