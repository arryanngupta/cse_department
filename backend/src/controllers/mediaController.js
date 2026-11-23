// backend/src/controllers/mediaController.js
//
// Media library: catalogue, browse, reuse, and find broken references.

import { Op } from 'sequelize';
import * as models from '../db/models/index.js';
import { MediaAsset, sequelize } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { escapeLike } from '../utils/sql.js';

/**
 * Every column across the schema that stores a media URL.
 *
 * Used both to reconcile the catalogue with content already in the database
 * and to report which records use a given asset.
 */
const MEDIA_COLUMNS = [
  { model: 'Slider', column: 'image_path', label: 'Hero sliders' },
  { model: 'People', column: 'photo_path', label: 'Faculty photos' },
  { model: 'News', column: 'image_path', label: 'News images' },
  { model: 'Event', column: 'banner_path', label: 'Event banners' },
  { model: 'Achievement', column: 'image_path', label: 'Achievement images' },
  { model: 'Research', column: 'image_path', label: 'Research images' },
  { model: 'Facility', column: 'image_path', label: 'Facility images' },
  { model: 'InfoBlock', column: 'media_path', label: 'Info block media' },
  { model: 'Opportunity', column: 'image_path', label: 'Opportunity images' },
  { model: 'Newsletter', column: 'pdf_path', label: 'Newsletter PDFs' },
  { model: 'Program', column: 'curriculum_pdf_path', label: 'Curriculum PDFs' },
];

const kindFromUrl = (url) => {
  const clean = String(url || '').split('?')[0].toLowerCase();
  if (clean.endsWith('.pdf')) return 'pdf';
  if (/\.(jpe?g|png|webp|gif|avif|svg)$/.test(clean)) return 'image';
  // Cloudinary image delivery URLs carry /image/upload/ even without an
  // extension, so fall back to that before giving up.
  if (clean.includes('/image/upload/')) return 'image';
  if (clean.includes('/raw/upload/') || clean.includes('/pdfs/')) return 'pdf';
  return 'other';
};

/** Derive Cloudinary's public_id from a delivery URL. */
const publicIdFromUrl = (url) => {
  const match = String(url || '').match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return match ? match[1] : null;
};

const filenameFromUrl = (url) => {
  try {
    const path = new URL(url).pathname;
    return decodeURIComponent(path.split('/').pop() || '') || null;
  } catch {
    return String(url || '').split('/').pop() || null;
  }
};

/** GET /api/admin/media — browse the library. */
export const listMedia = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 40 });
    const { kind, q } = req.query;

    const where = {};
    if (kind && ['image', 'pdf', 'other'].includes(kind)) where.kind = kind;

    if (q) {
      const pattern = `%${escapeLike(q)}%`;
      where[Op.or] = [
        { title: { [Op.like]: pattern } },
        { filename: { [Op.like]: pattern } },
        { alt_text: { [Op.like]: pattern } },
      ];
    }

    const { count, rows } = await MediaAsset.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const byKind = await MediaAsset.findAll({
      attributes: ['kind', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      group: ['kind'],
      raw: true,
    });

    res.json({
      data: rows,
      meta: {
        ...buildMeta(count, { page, limit }),
        byKind: Object.fromEntries(byKind.map((k) => [k.kind, Number(k.n)])),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/media/sync
 *
 * Catalogues media already referenced by content. The library was added after
 * years of uploads, so without this it would start empty and be useless.
 * Idempotent — re-running only adds URLs not already present.
 */
export const syncMedia = async (req, res, next) => {
  try {
    const seen = new Map();

    for (const { model, column } of MEDIA_COLUMNS) {
      const Model = models[model];
      if (!Model || !Model.getAttributes()[column]) continue;

      const rows = await Model.findAll({
        where: {
          [column]: { [Op.ne]: null, [Op.ne]: '' },
        },
        attributes: ['id', column],
        raw: true,
      });

      for (const row of rows) {
        const url = String(row[column] || '').trim();
        // Only catalogue absolute URLs; a legacy relative path has no asset.
        if (!url.startsWith('http')) continue;
        if (!seen.has(url)) seen.set(url, true);
      }
    }

    const urls = [...seen.keys()];
    if (!urls.length) {
      return res.json({ data: { scanned: 0, added: 0, alreadyKnown: 0 } });
    }

    const existing = await MediaAsset.findAll({
      where: { url: { [Op.in]: urls } },
      attributes: ['url'],
      raw: true,
    });
    const known = new Set(existing.map((e) => e.url));

    const toCreate = urls
      .filter((url) => !known.has(url))
      .map((url) => ({
        url,
        public_id: publicIdFromUrl(url),
        filename: filenameFromUrl(url),
        kind: kindFromUrl(url),
        uploaded_by: null,
      }));

    if (toCreate.length) {
      // ignoreDuplicates guards against a concurrent sync inserting the same
      // URL between the existence check and this insert.
      await MediaAsset.bulkCreate(toCreate, { ignoreDuplicates: true });
    }

    res.json({
      data: {
        scanned: urls.length,
        added: toCreate.length,
        alreadyKnown: urls.length - toCreate.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /api/admin/media/:id — edit title / alt text / folder. */
export const updateMedia = async (req, res, next) => {
  try {
    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset) throw new ApiError(404, 'Media asset not found');

    const payload = {};
    for (const field of ['title', 'alt_text', 'folder']) {
      if (field in (req.body || {})) {
        const value = req.body[field];
        payload[field] = value === null || value === '' ? null : String(value).slice(0, 500);
      }
    }

    if (!Object.keys(payload).length) {
      throw new ApiError(400, 'Provide title, alt_text and/or folder');
    }

    await asset.update(payload);
    res.json({ data: asset });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/media/:id/usage — which records reference this asset.
 *
 * Shown before deletion, so nobody removes an image that is still on a page.
 */
export const mediaUsage = async (req, res, next) => {
  try {
    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset) throw new ApiError(404, 'Media asset not found');

    const usage = [];

    for (const { model, column, label } of MEDIA_COLUMNS) {
      const Model = models[model];
      if (!Model || !Model.getAttributes()[column]) continue;

      const rows = await Model.findAll({
        where: { [column]: asset.url },
        attributes: ['id'],
        raw: true,
      });

      for (const row of rows) {
        usage.push({ area: label, model, id: row.id });
      }
    }

    res.json({
      data: {
        asset: { id: asset.id, url: asset.url, filename: asset.filename },
        usedIn: usage,
        inUse: usage.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/media/:id
 *
 * Removes the catalogue entry only. The Cloudinary file is deliberately left
 * alone: a URL may still be referenced by content this catalogue does not know
 * about, and deleting the remote file would break those pages irreversibly.
 * Refuses while the asset is still referenced.
 */
export const deleteMedia = async (req, res, next) => {
  try {
    const asset = await MediaAsset.findByPk(req.params.id);
    if (!asset) throw new ApiError(404, 'Media asset not found');

    for (const { model, column, label } of MEDIA_COLUMNS) {
      const Model = models[model];
      if (!Model || !Model.getAttributes()[column]) continue;

      const count = await Model.count({ where: { [column]: asset.url } });
      if (count > 0) {
        throw new ApiError(
          409,
          `This file is still used by ${count} record(s) in ${label}. Replace it there first.`,
        );
      }
    }

    await asset.destroy();
    res.json({
      data: {
        success: true,
        note: 'Removed from the library. The file itself remains in Cloudinary.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/media/broken-references
 *
 * Content rows pointing at a media URL that is not in the library, plus
 * library entries nothing references. Both are things an editor should know.
 */
export const brokenReferences = async (req, res, next) => {
  try {
    const catalogued = new Set(
      (await MediaAsset.findAll({ attributes: ['url'], raw: true })).map((a) => a.url),
    );

    const referenced = new Set();
    const uncatalogued = [];
    const relativePaths = [];

    for (const { model, column, label } of MEDIA_COLUMNS) {
      const Model = models[model];
      if (!Model || !Model.getAttributes()[column]) continue;

      const rows = await Model.findAll({
        where: { [column]: { [Op.ne]: null, [Op.ne]: '' } },
        attributes: ['id', column],
        raw: true,
      });

      for (const row of rows) {
        const url = String(row[column] || '').trim();
        if (!url) continue;

        // A legacy relative path cannot resolve now that media is on
        // Cloudinary — worth flagging separately from a missing catalogue row.
        if (!url.startsWith('http')) {
          relativePaths.push({ area: label, model, id: row.id, value: url });
          continue;
        }

        referenced.add(url);
        if (!catalogued.has(url)) {
          uncatalogued.push({ area: label, model, id: row.id, url });
        }
      }
    }

    const unused = [...catalogued].filter((url) => !referenced.has(url));

    res.json({
      data: {
        relativePaths,
        uncatalogued,
        unusedAssets: unused,
        summary: {
          relativePaths: relativePaths.length,
          uncatalogued: uncatalogued.length,
          unused: unused.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
