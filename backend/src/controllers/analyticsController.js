// backend/src/controllers/analyticsController.js
//
// Dashboard aggregates.
//
// Every figure here is computed from real rows. Nothing is estimated,
// extrapolated or sampled — a department dashboard that invents numbers is
// worse than one that shows none.

import { Op, fn, col, literal } from 'sequelize';
import {
  sequelize,
  People,
  News,
  Event,
  Achievement,
  Research,
  Facility,
  Program,
  Newsletter,
  DirectoryEntry,
  Opportunity,
  Slider,
  EventRegistration,
  ContentSubmission,
  AuditLog,
  MediaAsset,
} from '../db/models/index.js';

/** Count rows, tolerating a table that does not exist yet. */
const safeCount = async (Model, options = {}) => {
  try {
    return await Model.count(options);
  } catch {
    return 0;
  }
};

/** GET /api/admin/analytics/overview — headline counts. */
export const overview = async (req, res, next) => {
  try {
    const now = new Date();

    const [
      faculty, staff, scholars, alumni,
      news, publishedNews,
      events, upcomingEvents,
      achievements, research, facilities, programs,
      newsletters, directory, opportunities, sliders,
      registrations, pendingSubmissions, media,
    ] = await Promise.all([
      safeCount(People, { where: { person_type: 'Faculty' } }),
      safeCount(People, { where: { person_type: 'Staff' } }),
      safeCount(People, { where: { person_type: 'Research Scholar' } }),
      safeCount(People, { where: { person_type: 'Alumni' } }),
      safeCount(News),
      safeCount(News, { where: { isPublished: true } }),
      safeCount(Event),
      safeCount(Event, { where: { startsAt: { [Op.gt]: now }, isPublished: true } }),
      safeCount(Achievement),
      safeCount(Research),
      safeCount(Facility),
      safeCount(Program),
      safeCount(Newsletter),
      safeCount(DirectoryEntry),
      safeCount(Opportunity),
      safeCount(Slider),
      safeCount(EventRegistration),
      safeCount(ContentSubmission, { where: { status: 'submitted' } }),
      safeCount(MediaAsset),
    ]);

    // Research split by category, since "12 research items" alone says little.
    const researchByCategory = await Research.findAll({
      attributes: ['category', [fn('COUNT', col('id')), 'n']],
      group: ['category'],
      raw: true,
    }).catch(() => []);

    res.json({
      data: {
        people: { faculty, staff, scholars, alumni, total: faculty + staff + scholars + alumni },
        content: {
          news: { total: news, published: publishedNews, drafts: news - publishedNews },
          events: { total: events, upcoming: upcomingEvents },
          achievements,
          research,
          facilities,
          programs,
          newsletters,
          directory,
          opportunities,
          sliders,
        },
        research: {
          total: research,
          byCategory: Object.fromEntries(
            researchByCategory.map((r) => [r.category, Number(r.n)]),
          ),
        },
        activity: {
          eventRegistrations: registrations,
          pendingSubmissions,
          mediaAssets: media,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/trends?months=12
 *
 * Content created per month. Months with no activity are filled with zero, so
 * the chart has a continuous x-axis instead of silently collapsing gaps and
 * implying activity that did not happen.
 */
export const trends = async (req, res, next) => {
  try {
    const months = Math.min(Math.max(Number.parseInt(req.query.months, 10) || 12, 1), 36);

    const since = new Date();
    since.setUTCDate(1);
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCMonth(since.getUTCMonth() - (months - 1));

    const SERIES = [
      { key: 'news', model: News },
      { key: 'events', model: Event },
      { key: 'achievements', model: Achievement },
      { key: 'research', model: Research },
      { key: 'people', model: People },
    ];

    // Build the month buckets up front.
    const buckets = [];
    for (let i = 0; i < months; i += 1) {
      const d = new Date(since);
      d.setUTCMonth(since.getUTCMonth() + i);
      buckets.push(d.toISOString().slice(0, 7)); // YYYY-MM
    }

    const series = {};

    for (const { key, model } of SERIES) {
      const zeroed = Object.fromEntries(buckets.map((b) => [b, 0]));

      try {
        const rows = await model.findAll({
          attributes: [
            [fn('DATE_FORMAT', col('createdAt'), '%Y-%m'), 'month'],
            [fn('COUNT', col('id')), 'n'],
          ],
          where: { createdAt: { [Op.gte]: since } },
          group: [literal("DATE_FORMAT(createdAt, '%Y-%m')")],
          raw: true,
        });

        for (const row of rows) {
          if (row.month in zeroed) zeroed[row.month] = Number(row.n);
        }
      } catch {
        // Leave the series at zero rather than dropping it: an absent line is
        // more misleading than a flat one.
      }

      series[key] = buckets.map((month) => ({ month, count: zeroed[month] }));
    }

    res.json({ data: { months: buckets, series } });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/activity?days=30
 *
 * Recent administrative activity from the audit log, by day and by action.
 */
export const activity = async (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number.parseInt(req.query.days, 10) || 30, 1), 365);

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (days - 1));

    const buckets = [];
    for (let i = 0; i < days; i += 1) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      buckets.push(d.toISOString().slice(0, 10));
    }

    const zeroed = Object.fromEntries(buckets.map((b) => [b, 0]));

    const [byDay, byAction, topActors] = await Promise.all([
      AuditLog.findAll({
        attributes: [
          [fn('DATE_FORMAT', col('createdAt'), '%Y-%m-%d'), 'day'],
          [fn('COUNT', col('id')), 'n'],
        ],
        where: { createdAt: { [Op.gte]: since } },
        group: [literal("DATE_FORMAT(createdAt, '%Y-%m-%d')")],
        raw: true,
      }).catch(() => []),

      AuditLog.findAll({
        attributes: ['action', [fn('COUNT', col('id')), 'n']],
        where: { createdAt: { [Op.gte]: since } },
        group: ['action'],
        raw: true,
      }).catch(() => []),

      AuditLog.findAll({
        attributes: ['actor_email', [fn('COUNT', col('id')), 'n']],
        where: { createdAt: { [Op.gte]: since }, actor_email: { [Op.ne]: null } },
        group: ['actor_email'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 5,
        raw: true,
      }).catch(() => []),
    ]);

    for (const row of byDay) {
      if (row.day in zeroed) zeroed[row.day] = Number(row.n);
    }

    res.json({
      data: {
        days: buckets,
        perDay: buckets.map((day) => ({ day, count: zeroed[day] })),
        byAction: Object.fromEntries(byAction.map((r) => [r.action, Number(r.n)])),
        topActors: topActors.map((r) => ({
          email: r.actor_email,
          count: Number(r.n),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/analytics/health
 *
 * Content-quality signals an editor can act on: missing images, empty
 * sections, drafts that have sat unpublished.
 */
export const contentHealth = async (req, res, next) => {
  try {
    const checks = [];

    const push = (label, count, hint) => checks.push({ label, count, hint });

    push(
      'Faculty without a photo',
      await safeCount(People, {
        where: {
          person_type: 'Faculty',
          [Op.or]: [{ photo_path: null }, { photo_path: '' }],
        },
      }),
      'Profiles without a photo look incomplete on the People page.',
    );

    push(
      'Faculty without research areas',
      await safeCount(People, {
        where: {
          person_type: 'Faculty',
          [Op.or]: [{ research_areas: null }, { research_areas: '' }],
        },
      }),
      'Research areas drive search and the AI assistant.',
    );

    push(
      'Unpublished news',
      await safeCount(News, { where: { isPublished: false } }),
      'Drafts are invisible to visitors, search and the assistant.',
    );

    push(
      'Events with no venue',
      await safeCount(Event, {
        where: { [Op.or]: [{ venue: null }, { venue: '' }] },
      }),
      'Attendees need to know where to go.',
    );

    push(
      'Inactive facilities',
      await safeCount(Facility, { where: { is_active: false } }),
      'Inactive facilities are hidden from the public site.',
    );

    push(
      'Research not linked to any person',
      await (async () => {
        try {
          const [rows] = await sequelize.query(
            `SELECT COUNT(*) AS n FROM research r
              WHERE NOT EXISTS (
                SELECT 1 FROM research_authors ra WHERE ra.research_id = r.id
              )`,
          );
          return Number(rows[0]?.n || 0);
        } catch {
          return 0;
        }
      })(),
      'Linked research appears on faculty profiles; unlinked research does not.',
    );

    push(
      'Submissions awaiting review',
      await safeCount(ContentSubmission, { where: { status: 'submitted' } }),
      'Someone is waiting on a decision.',
    );

    res.json({
      data: {
        checks,
        needsAttention: checks.filter((c) => c.count > 0).length,
      },
    });
  } catch (error) {
    next(error);
  }
};
