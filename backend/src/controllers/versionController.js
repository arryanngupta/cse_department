// backend/src/controllers/versionController.js

import * as models from '../db/models/index.js';
import { ContentVersion, sequelize } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import {
  VERSIONED_RESOURCES,
  recordVersion,
  parseSnapshot,
  compareToCurrent,
  snapshotOf,
} from '../services/versioningService.js';

const assertVersioned = (resource) => {
  if (!VERSIONED_RESOURCES[resource]) {
    throw new ApiError(
      400,
      `"${resource}" does not keep version history. Versioned resources: ${Object.keys(
        VERSIONED_RESOURCES,
      ).join(', ')}`,
    );
  }
};

/** GET /api/admin/versions/:resource/:id — history for one record. */
export const listVersions = async (req, res, next) => {
  try {
    const { resource, id } = req.params;
    assertVersioned(resource);

    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });

    const { count, rows } = await ContentVersion.findAndCountAll({
      where: { resource, resource_id: id },
      order: [['version', 'DESC']],
      // The snapshot can be very large; the list view only needs metadata.
      attributes: { exclude: ['snapshot'] },
      limit,
      offset,
    });

    res.json({ data: rows, meta: buildMeta(count, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/versions/:resource/:id/:version — one snapshot plus a diff. */
export const getVersion = async (req, res, next) => {
  try {
    const { resource, id, version } = req.params;
    assertVersioned(resource);

    const record = await ContentVersion.findOne({
      where: { resource, resource_id: id, version },
    });
    if (!record) throw new ApiError(404, 'Version not found');

    const snapshot = parseSnapshot(record);
    if (!snapshot) throw new ApiError(500, 'This version snapshot could not be read');

    const Model = models[VERSIONED_RESOURCES[resource]];
    const current = await Model.findByPk(id);

    res.json({
      data: {
        version: record.version,
        change_type: record.change_type,
        changed_fields: record.changed_fields,
        actor_email: record.actor_email,
        createdAt: record.createdAt,
        snapshot,
        // Null when the record was deleted — the diff is then "everything".
        currentExists: Boolean(current),
        diff: compareToCurrent(snapshot, current),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/versions/:resource/:id/:version/restore
 *
 * Restoring is itself a versioned change: the pre-restore state is snapshotted
 * first, so a restore can always be undone.
 */
export const restoreVersion = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const { resource, id, version } = req.params;
    assertVersioned(resource);

    const record = await ContentVersion.findOne({
      where: { resource, resource_id: id, version },
      transaction: tx,
    });
    if (!record) throw new ApiError(404, 'Version not found');

    const snapshot = parseSnapshot(record);
    if (!snapshot) throw new ApiError(500, 'This version snapshot could not be read');

    const Model = models[VERSIONED_RESOURCES[resource]];
    const current = await Model.findByPk(id, { transaction: tx });

    if (!current) {
      // The row was deleted. Re-creating it would reuse an id that other
      // tables may have repointed, so this is refused rather than guessed at.
      throw new ApiError(
        409,
        'The record no longer exists. Re-create it, then restore a version onto the new record.',
      );
    }

    // Detached copy: current.get({plain:true}) returns dataValues itself, so
    // the later current.update() would otherwise rewrite this snapshot in
    // place and the restore could never be undone.
    const preRestore = snapshotOf(current);

    // Never write the primary key or timestamps back.
    const { id: _ignoredId, createdAt: _c, updatedAt: _u, ...fields } = snapshot;

    // Only assign columns the model actually declares — a snapshot taken
    // before a migration may contain fields that no longer exist.
    const known = new Set(Object.keys(Model.getAttributes()));
    const payload = {};
    const skipped = [];

    for (const [key, value] of Object.entries(fields)) {
      if (known.has(key)) payload[key] = value;
      else skipped.push(key);
    }

    await current.update(payload, { transaction: tx });
    await tx.commit();

    // Record the pre-restore state, so this restore can itself be rolled back.
    await recordVersion({
      resource,
      resourceId: Number(id),
      before: preRestore,
      after: await Model.findByPk(id),
      changeType: 'restore',
      user: req.user,
    });

    res.json({
      data: {
        restoredFromVersion: Number(version),
        skippedFields: skipped,
        message: `Restored ${resource} #${id} to version ${version}.`,
      },
    });
  } catch (error) {
    await tx.rollback().catch(() => {});
    next(error);
  }
};

/** GET /api/admin/versions — recent activity across all resources. */
export const recentVersions = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 50 });
    const { resource } = req.query;

    const where = {};
    if (resource && VERSIONED_RESOURCES[resource]) where.resource = resource;

    const { count, rows } = await ContentVersion.findAndCountAll({
      where,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      attributes: { exclude: ['snapshot'] },
      limit,
      offset,
    });

    res.json({
      data: rows,
      meta: {
        ...buildMeta(count, { page, limit }),
        versionedResources: Object.keys(VERSIONED_RESOURCES),
      },
    });
  } catch (error) {
    next(error);
  }
};
