// backend/src/middleware/versionCapture.js
//
// Captures a "before" snapshot for versionable admin mutations.
//
// The snapshot has to be read *before* the controller runs, which is why this
// is middleware rather than an after-the-fact hook: once the UPDATE has
// committed, the previous content is gone.

import * as models from '../db/models/index.js';
import {
  VERSIONED_RESOURCES,
  recordVersion,
  snapshotOf,
} from '../services/versioningService.js';

/**
 * Pull the resource key and numeric id out of an admin path.
 *
 *   /api/admin/news/12            -> { resource: 'news', id: 12 }
 *   /api/admin/info-blocks/3      -> { resource: 'info-blocks', id: 3 }
 *   /api/admin/programs/3/sections-> null (nested; not a versioned record)
 */
const parse = (path) => {
  const parts = path
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter((p) => p && p !== 'api' && p !== 'admin');

  // Exactly "<resource>/<id>" — anything deeper is a sub-resource.
  if (parts.length !== 2) return null;

  const [resource, rawId] = parts;
  if (!VERSIONED_RESOURCES[resource]) return null;
  if (!/^\d+$/.test(rawId)) return null;

  return { resource, id: Number(rawId) };
};

export const versionCapture = async (req, res, next) => {
  // Creates have no previous state; deletes and updates do.
  if (req.method !== 'PUT' && req.method !== 'PATCH' && req.method !== 'DELETE') {
    return next();
  }

  const target = parse(req.originalUrl.split('?')[0]);
  if (!target) return next();

  try {
    const Model = models[VERSIONED_RESOURCES[target.resource]];
    if (!Model) return next();

    const before = await Model.findByPk(target.id);
    if (!before) return next(); // 404 is the controller's business.

    // Detached copy — see snapshotOf: get({plain:true}) aliases dataValues.
    const snapshot = snapshotOf(before);
    const changeType = req.method === 'DELETE' ? 'delete' : 'update';

    res.on('finish', async () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      // Re-read on update so the diff reflects what was actually persisted
      // rather than what the request asked for.
      let after = null;
      if (changeType === 'update') {
        after = await Model.findByPk(target.id).catch(() => null);
      }

      await recordVersion({
        resource: target.resource,
        resourceId: target.id,
        before: snapshot,
        after,
        changeType,
        user: req.user,
      });
    });
  } catch (error) {
    // A failure here must not block the request.
    console.error('versionCapture failed:', error?.message);
  }

  return next();
};
