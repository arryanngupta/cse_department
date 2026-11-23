// backend/src/controllers/auditLogController.js

import { Op } from 'sequelize';
import { AuditLog, sequelize } from '../db/models/index.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { escapeLike } from '../utils/sql.js';

/**
 * GET /api/admin/audit-logs
 *
 * Read-only by design. There is no update or delete endpoint: an audit trail
 * an ordinary admin can edit is not an audit trail. Pruning old entries is a
 * database-level task, deliberately outside the application's reach.
 */
export const listAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
    const { action, resource, actor, from, to, q } = req.query;

    const where = {};

    if (action) where.action = action;
    if (resource) where.resource = { [Op.like]: `%${escapeLike(resource)}%` };
    if (actor) where.actor_email = { [Op.like]: `%${escapeLike(actor)}%` };

    // Dates are validated before use: an unparseable value would otherwise
    // become `Invalid Date` and make the whole query return nothing silently.
    const createdAt = {};
    if (from) {
      const d = new Date(from);
      if (!Number.isNaN(d.getTime())) createdAt[Op.gte] = d;
    }
    if (to) {
      const d = new Date(to);
      if (!Number.isNaN(d.getTime())) createdAt[Op.lte] = d;
    }
    if (Object.getOwnPropertySymbols(createdAt).length) where.createdAt = createdAt;

    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      where[Op.or] = [
        { summary: { [Op.like]: pattern } },
        { path: { [Op.like]: pattern } },
        { actor_email: { [Op.like]: pattern } },
      ];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    });

    res.json({ data: rows, meta: buildMeta(count, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/audit-logs/summary — counts for the dashboard filters. */
export const auditLogSummary = async (req, res, next) => {
  try {
    const [byAction, byResource, total] = await Promise.all([
      AuditLog.findAll({
        attributes: ['action', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['action'],
        raw: true,
      }),
      AuditLog.findAll({
        attributes: ['resource', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
        group: ['resource'],
        order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']],
        limit: 20,
        raw: true,
      }),
      AuditLog.count(),
    ]);

    res.json({
      data: {
        total,
        byAction: Object.fromEntries(byAction.map((r) => [r.action, Number(r.n)])),
        byResource: byResource.map((r) => ({ resource: r.resource, count: Number(r.n) })),
      },
    });
  } catch (error) {
    next(error);
  }
};
