// backend/src/services/versioningService.js
//
// Snapshot and restore for versionable content.
//
// Implemented as an explicit service rather than Sequelize hooks: hooks fire
// on bulk operations and seeders too, which would fill the history with noise
// from `npm run seed` and make "version 1" meaningless.

import { ContentVersion } from '../db/models/index.js';

/**
 * Entities whose history is worth keeping, mapped to their model name.
 *
 * Deliberately excludes join/config tables (research_authors, curriculum rows,
 * event_registrations) — those are small, derived, or personal data that
 * should not be duplicated into a second long-lived table.
 */
export const VERSIONED_RESOURCES = {
  news: 'News',
  events: 'Event',
  people: 'People',
  programs: 'Program',
  research: 'Research',
  facilities: 'Facility',
  achievements: 'Achievement',
  'info-blocks': 'InfoBlock',
  opportunities: 'Opportunity',
  newsletters: 'Newsletter',
};

/** Columns never worth storing in a snapshot. */
const SKIP_FIELDS = new Set(['createdAt', 'updatedAt', 'password_hash']);

/**
 * Detach a row into a plain, independent object.
 *
 * `instance.get({ plain: true })` returns `instance.dataValues` *itself*, not a
 * copy — verified: `instance.get({plain:true}) === instance.dataValues` is
 * true. So a later `instance.update()` retroactively mutates anything holding
 * that reference, which silently corrupted "before" snapshots into "after"
 * snapshots. Callers must always go through this.
 */
export const snapshotOf = (instance) => {
  const row = typeof instance?.get === 'function' ? instance.get({ plain: true }) : instance;
  if (!row) return {};

  const copy = {};
  for (const [key, value] of Object.entries(row)) {
    if (SKIP_FIELDS.has(key)) continue;
    // Nested objects (JSON columns such as profile_sections) alias too, so the
    // copy has to be deep. The snapshot is JSON-serialised regardless, which
    // makes a structured clone the cheapest correct option.
    copy[key] =
      value && typeof value === 'object' ? structuredClone(value) : value;
  }
  return copy;
};

const plain = snapshotOf;

/** Field names whose values differ between two snapshots. */
const diffFields = (before, after) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changed = [];

  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    // JSON comparison so objects and arrays compare by value, not reference.
    if (JSON.stringify(a ?? null) !== JSON.stringify(b ?? null)) changed.push(key);
  }

  return changed;
};

/**
 * Record a snapshot.
 *
 * Never throws: losing a history entry must not fail the content change that
 * the user actually asked for. Failures are logged instead.
 *
 * @param {object}  options
 * @param {string}  options.resource    Key from VERSIONED_RESOURCES.
 * @param {number}  options.resourceId
 * @param {object}  options.before      Row as it was (the snapshot stored).
 * @param {object}  [options.after]     Row as it became, for the field diff.
 * @param {string}  options.changeType  create | update | delete | restore
 * @param {object}  [options.user]      req.user
 */
export const recordVersion = async ({
  resource,
  resourceId,
  before,
  after,
  changeType,
  user,
}) => {
  try {
    if (!VERSIONED_RESOURCES[resource]) return null;

    const snapshot = plain(before);
    const next = after ? plain(after) : null;

    // Per-record version numbers, so the UI can say "version 3 of 7".
    const latest = await ContentVersion.max('version', {
      where: { resource, resource_id: resourceId },
    });

    const version = (Number.isFinite(latest) ? latest : 0) + 1;

    return await ContentVersion.create({
      resource,
      resource_id: resourceId,
      version,
      change_type: changeType,
      snapshot: JSON.stringify(snapshot),
      changed_fields: next ? diffFields(snapshot, next).join(', ').slice(0, 2000) || null : null,
      user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
    });
  } catch (error) {
    console.error(
      `Failed to record version for ${resource}#${resourceId}:`,
      error?.message,
    );
    return null;
  }
};

/** Parse a stored snapshot, tolerating corruption rather than throwing. */
export const parseSnapshot = (version) => {
  try {
    return JSON.parse(version.snapshot);
  } catch {
    return null;
  }
};

/**
 * Field-level comparison between a stored version and the live row.
 *
 * Values are truncated for display: a diff view should show what changed, not
 * re-render an entire rich-text body inline.
 */
export const compareToCurrent = (snapshot, current) => {
  const keys = new Set([
    ...Object.keys(snapshot || {}),
    ...Object.keys(plain(current) || {}),
  ]);

  const live = plain(current);
  const fields = [];

  for (const key of [...keys].sort()) {
    const from = snapshot?.[key] ?? null;
    const to = live?.[key] ?? null;
    const changed = JSON.stringify(from) !== JSON.stringify(to);

    fields.push({
      field: key,
      changed,
      from: truncate(from),
      to: truncate(to),
    });
  }

  return fields;
};

const truncate = (value, max = 400) => {
  if (value === null || value === undefined) return null;

  // Render both sides the same way or an unchanged field looks changed.
  // A snapshot round-trips through JSON, so its dates come back as strings,
  // while the live row holds Date instances. Stringifying only the non-string
  // side wrapped the live value in quotes — the diff then showed
  //   was: 2024-10-14T18:30:00.000Z
  //   now: "2024-10-14T18:30:00.000Z"
  // for a field that had not been touched.
  let text;
  if (typeof value === 'string') text = value;
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === 'object') text = JSON.stringify(value);
  else text = String(value);

  return text.length > max ? `${text.slice(0, max)}…` : text;
};
