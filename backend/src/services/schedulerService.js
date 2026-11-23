// backend/src/services/schedulerService.js
//
// Durable scheduled publication.
//
// The schedule is stored in the database (`publish_at` / `unpublish_at`), and
// a worker polls for anything due. That design is deliberate: an in-memory
// timer is lost on every restart, and this backend restarts often — Render's
// free tier sleeps on inactivity, and every redeploy replaces the process.
// Because state is data, a restart loses nothing; the next tick catches up on
// everything that came due while the process was down.

import { Op } from 'sequelize';
import { Event, News, Achievement, Facility, Opportunity } from '../db/models/index.js';

/** Models that support scheduling, with the column that marks them live. */
const SCHEDULABLE = [
  { name: 'news', model: News, flag: 'isPublished' },
  { name: 'events', model: Event, flag: 'isPublished' },
  { name: 'achievements', model: Achievement, flag: 'isPublished' },
  { name: 'facilities', model: Facility, flag: 'is_active' },
  { name: 'opportunities', model: Opportunity, flag: 'is_active' },
];

export const SCHEDULABLE_RESOURCES = SCHEDULABLE.map((s) => s.name);

/**
 * Apply every schedule that has come due.
 *
 * Idempotent: a row is only touched when its flag does not already match what
 * the schedule says, so repeated runs (or two instances ticking at once) are
 * harmless. `publish_at` is cleared once applied, so a row is never published
 * twice and the queue drains.
 *
 * @param {Date} [now]
 * @returns {Promise<{published: object, unpublished: object, at: string}>}
 */
export const runDueSchedules = async (now = new Date()) => {
  const published = {};
  const unpublished = {};

  for (const { name, model, flag } of SCHEDULABLE) {
    try {
      // --- Publish anything whose time has arrived -------------------------
      const toPublish = await model.findAll({
        where: {
          publish_at: { [Op.ne]: null, [Op.lte]: now },
          [flag]: false,
        },
        attributes: ['id'],
      });

      if (toPublish.length) {
        await model.update(
          { [flag]: true, publish_at: null },
          { where: { id: { [Op.in]: toPublish.map((r) => r.id) } } },
        );
        published[name] = toPublish.length;
      }

      // Clear a stale publish_at on something already live, so the queue does
      // not keep re-matching rows it cannot change.
      await model.update(
        { publish_at: null },
        { where: { publish_at: { [Op.ne]: null, [Op.lte]: now }, [flag]: true } },
      );

      // --- Unpublish anything that has expired -----------------------------
      const toUnpublish = await model.findAll({
        where: {
          unpublish_at: { [Op.ne]: null, [Op.lte]: now },
          [flag]: true,
        },
        attributes: ['id'],
      });

      if (toUnpublish.length) {
        await model.update(
          { [flag]: false, unpublish_at: null },
          { where: { id: { [Op.in]: toUnpublish.map((r) => r.id) } } },
        );
        unpublished[name] = toUnpublish.length;
      }

      await model.update(
        { unpublish_at: null },
        { where: { unpublish_at: { [Op.ne]: null, [Op.lte]: now }, [flag]: false } },
      );
    } catch (error) {
      // One failing resource must not stop the rest of the sweep.
      console.error(`Scheduler failed for ${name}:`, error?.message);
    }
  }

  return { published, unpublished, at: now.toISOString() };
};

/** Everything currently scheduled, for the admin view. */
export const listScheduled = async () => {
  const items = [];

  for (const { name, model, flag } of SCHEDULABLE) {
    try {
      const rows = await model.findAll({
        where: {
          [Op.or]: [
            { publish_at: { [Op.ne]: null } },
            { unpublish_at: { [Op.ne]: null } },
          ],
        },
        order: [['publish_at', 'ASC']],
        limit: 100,
      });

      for (const row of rows) {
        const r = row.get({ plain: true });
        items.push({
          resource: name,
          id: r.id,
          title: r.title || r.name || `#${r.id}`,
          live: Boolean(r[flag]),
          publish_at: r.publish_at,
          unpublish_at: r.unpublish_at,
        });
      }
    } catch (error) {
      console.error(`Could not list schedule for ${name}:`, error?.message);
    }
  }

  return items.sort((a, b) => {
    const at = a.publish_at || a.unpublish_at || '';
    const bt = b.publish_at || b.unpublish_at || '';
    return String(at).localeCompare(String(bt));
  });
};

let timer = null;

/**
 * Start the polling worker.
 *
 * Interval rather than cron: minute-level accuracy is ample for publishing
 * content, and a plain interval has no extra dependency and no separate
 * process to keep alive.
 *
 * Safe to run on several instances at once — `runDueSchedules` is idempotent,
 * so the worst case is two instances both finding nothing left to do.
 */
export const startScheduler = ({ intervalMs } = {}) => {
  const interval = Number(intervalMs ?? process.env.SCHEDULER_INTERVAL_MS) || 60_000;

  if (process.env.SCHEDULER_ENABLED === 'false') {
    console.log('✓ Scheduler disabled (SCHEDULER_ENABLED=false)');
    return null;
  }

  const tick = async () => {
    try {
      const result = await runDueSchedules();
      const changed =
        Object.keys(result.published).length + Object.keys(result.unpublished).length;

      // Only log when something actually happened; a quiet tick every minute
      // would bury real events in the log.
      if (changed) {
        console.log(
          '✓ Scheduler applied:',
          JSON.stringify({ published: result.published, unpublished: result.unpublished }),
        );
      }
    } catch (error) {
      console.error('Scheduler tick failed:', error?.message);
    }
  };

  // Catch up immediately on boot: anything that came due while the process was
  // down should go live now, not at the end of the first interval.
  tick();

  timer = setInterval(tick, interval);
  // Do not hold the event loop open — the server's own listener does that.
  timer.unref?.();

  console.log(`✓ Scheduler running every ${Math.round(interval / 1000)}s`);
  return timer;
};

export const stopScheduler = () => {
  if (timer) clearInterval(timer);
  timer = null;
};
