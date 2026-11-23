// backend/src/controllers/scheduleController.js

import * as models from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import {
  listScheduled,
  runDueSchedules,
  SCHEDULABLE_RESOURCES,
} from '../services/schedulerService.js';

/** Resource key -> model name and the column that marks it live. */
const RESOURCE_MAP = {
  news: { model: 'News', flag: 'isPublished' },
  events: { model: 'Event', flag: 'isPublished' },
  achievements: { model: 'Achievement', flag: 'isPublished' },
  facilities: { model: 'Facility', flag: 'is_active' },
  opportunities: { model: 'Opportunity', flag: 'is_active' },
};

/** GET /api/admin/schedule — everything with a pending schedule. */
export const getSchedule = async (req, res, next) => {
  try {
    const items = await listScheduled();
    res.json({
      data: items,
      meta: { total: items.length, schedulable: SCHEDULABLE_RESOURCES },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/schedule/:resource/:id
 * Body: { publish_at, unpublish_at } — either may be null to clear.
 */
export const setSchedule = async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    const entry = RESOURCE_MAP[resource];

    if (!entry) {
      throw new ApiError(
        400,
        `"${resource}" cannot be scheduled. Schedulable: ${SCHEDULABLE_RESOURCES.join(', ')}`,
      );
    }

    const Model = models[entry.model];
    const row = await Model.findByPk(id);
    if (!row) throw new ApiError(404, `${resource} #${id} not found`);

    const payload = {};

    for (const field of ['publish_at', 'unpublish_at']) {
      if (!(field in (req.body || {}))) continue;

      const raw = req.body[field];

      if (raw === null || raw === '') {
        payload[field] = null;
        continue;
      }

      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${field} is not a valid date`);
      }
      payload[field] = date;
    }

    /**
     * `publish_now` clears the schedule and makes the record live in one step.
     *
     * This exists because scheduling a future publication sets the live flag
     * false, and simply clearing publish_at afterwards left the record hidden
     * *and* removed it from the scheduled list — so an editor who changed their
     * mind had silently unpublished their own content with no way to see it.
     * The live-flag column differs per resource (isPublished vs is_active), so
     * the mapping stays here rather than being reimplemented in the client.
     */
    if (req.body?.publish_now === true) {
      payload.publish_at = null;
      payload[entry.flag] = true;
    }

    if (!Object.keys(payload).length) {
      throw new ApiError(400, 'Provide publish_at, unpublish_at, or publish_now');
    }

    // An expiry before the publication time would publish and immediately
    // retract on the same tick.
    const publishAt = 'publish_at' in payload ? payload.publish_at : row.publish_at;
    const unpublishAt = 'unpublish_at' in payload ? payload.unpublish_at : row.unpublish_at;

    if (publishAt && unpublishAt && new Date(unpublishAt) <= new Date(publishAt)) {
      throw new ApiError(400, 'unpublish_at must be after publish_at');
    }

    // Scheduling a future publication implies it is not live yet; without this
    // the row stays visible and the schedule silently does nothing.
    if (payload.publish_at && new Date(payload.publish_at) > new Date()) {
      payload[entry.flag] = false;
    }

    await row.update(payload);

    res.json({
      data: {
        resource,
        id: Number(id),
        live: Boolean(row[entry.flag]),
        publish_at: row.publish_at,
        unpublish_at: row.unpublish_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/schedule/run
 *
 * Applies anything due immediately, instead of waiting for the next tick.
 * Useful for verifying a schedule and for a cron-style external trigger.
 */
export const runSchedulerNow = async (req, res, next) => {
  try {
    const result = await runDueSchedules();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};
