// backend/src/controllers/submissionController.js
//
// Content approval workflow.
//
// A submission carries the proposed values; the live record is untouched until
// an admin approves. Rejection therefore needs no rollback.

import * as models from '../db/models/index.js';
import { ContentSubmission, User, People, sequelize } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { sendTemplate } from '../services/emailService.js';
import { recordVersion, snapshotOf } from '../services/versioningService.js';
import { VERSIONED_RESOURCES } from '../services/versioningService.js';

/** Resources that accept submissions, mapped to their model name. */
const SUBMITTABLE = {
  news: 'News',
  events: 'Event',
  people: 'People',
  research: 'Research',
  facilities: 'Facility',
  achievements: 'Achievement',
  opportunities: 'Opportunity',
};

/** Fields no submission may ever set, whoever sends them. */
const PROTECTED_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'user_id',          // account linkage is an admin-only concern
  'password_hash',
  'slug',             // changing a slug breaks existing public links
]);

const assertSubmittable = (resource) => {
  if (!SUBMITTABLE[resource]) {
    throw new ApiError(
      400,
      `"${resource}" does not accept submissions. Accepted: ${Object.keys(SUBMITTABLE).join(', ')}`,
    );
  }
};

/** Keep only fields the model declares and that are not protected. */
const sanitizePayload = (resource, payload) => {
  const Model = models[SUBMITTABLE[resource]];
  const known = new Set(Object.keys(Model.getAttributes()));

  const clean = {};
  const rejected = [];

  for (const [key, value] of Object.entries(payload || {})) {
    if (PROTECTED_FIELDS.has(key)) {
      rejected.push(key);
      continue;
    }
    if (!known.has(key)) {
      rejected.push(key);
      continue;
    }
    clean[key] = value;
  }

  return { clean, rejected };
};

/**
 * A faculty user may only submit against their own profile.
 * Admins may submit against anything.
 */
const assertMaySubmit = async (user, resource, resourceId) => {
  if (user.role === 'super_admin' || user.role === 'admin') return;

  if (user.role !== 'faculty') {
    throw new ApiError(403, 'You do not have permission to submit content');
  }

  if (resource !== 'people') {
    throw new ApiError(
      403,
      'Faculty accounts may only submit changes to their own profile',
    );
  }

  const person = await People.findOne({
    where: { user_id: user.id },
    attributes: ['id'],
  });

  if (!person || Number(resourceId) !== person.id) {
    throw new ApiError(403, 'You may only submit changes to your own profile');
  }
};

/**
 * POST /api/admin/submissions
 * Body: { resource, resource_id, payload, note, submit }
 */
export const createSubmission = async (req, res, next) => {
  try {
    const { resource, resource_id: resourceId, payload, note, submit } = req.body || {};

    assertSubmittable(resource);

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new ApiError(400, 'payload must be an object of proposed field values');
    }

    if (resourceId !== null && resourceId !== undefined) {
      const Model = models[SUBMITTABLE[resource]];
      const exists = await Model.findByPk(resourceId, { attributes: ['id'] });
      if (!exists) throw new ApiError(404, `${resource} #${resourceId} not found`);
      await assertMaySubmit(req.user, resource, resourceId);
    } else {
      // Proposing a brand-new record is an admin action; faculty may only
      // amend their existing profile.
      if (req.user.role === 'faculty') {
        throw new ApiError(403, 'Faculty accounts may only submit profile changes');
      }
    }

    const { clean, rejected } = sanitizePayload(resource, payload);

    if (!Object.keys(clean).length) {
      throw new ApiError(
        400,
        `No editable fields in payload. Ignored: ${rejected.join(', ') || 'none'}`,
      );
    }

    const isSubmitted = submit !== false;

    const submission = await ContentSubmission.create({
      resource,
      resource_id: resourceId ?? null,
      status: isSubmitted ? 'submitted' : 'draft',
      payload: JSON.stringify(clean),
      note: note ? String(note).slice(0, 500) : null,
      submitted_by: req.user.id,
      submitter_email: req.user.email,
      submitted_at: isSubmitted ? new Date() : null,
    });

    // Tell reviewers there is something waiting. Inert without a mailer.
    if (isSubmitted) {
      const admins = await User.findAll({
        where: { role: ['admin', 'super_admin'] },
        attributes: ['email'],
      });

      const base = (process.env.SITE_DOMAIN || 'http://localhost:3021').replace(/\/$/, '');

      await sendTemplate('contentSubmitted', {
        to: admins.map((a) => a.email),
        submitterName: req.user.name || req.user.email,
        resource,
        title: clean.title || clean.name || `${resource} #${resourceId ?? 'new'}`,
        reviewUrl: `${base}/admin/submissions`,
      });
    }

    res.status(201).json({
      data: { ...submission.get({ plain: true }), ignoredFields: rejected },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/submissions — the review queue. */
export const listSubmissions = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 25 });
    const { status, resource } = req.query;

    const where = {};
    if (status) where.status = status;
    if (resource && SUBMITTABLE[resource]) where.resource = resource;

    // Faculty see only their own submissions.
    if (req.user.role === 'faculty') where.submitted_by = req.user.id;

    const { count, rows } = await ContentSubmission.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    const counts = await ContentSubmission.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
      where: req.user.role === 'faculty' ? { submitted_by: req.user.id } : {},
      group: ['status'],
      raw: true,
    });

    res.json({
      data: rows.map((r) => {
        const row = r.get({ plain: true });
        // Parse for convenience; a corrupt payload should not break the queue.
        try {
          row.payload = JSON.parse(row.payload);
        } catch {
          row.payload = null;
        }
        return row;
      }),
      meta: {
        ...buildMeta(count, { page, limit }),
        byStatus: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])),
        submittable: Object.keys(SUBMITTABLE),
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/admin/submissions/:id — one submission, with a field-level diff. */
export const getSubmission = async (req, res, next) => {
  try {
    const submission = await ContentSubmission.findByPk(req.params.id);
    if (!submission) throw new ApiError(404, 'Submission not found');

    if (req.user.role === 'faculty' && submission.submitted_by !== req.user.id) {
      throw new ApiError(403, 'You may only view your own submissions');
    }

    let payload = null;
    try {
      payload = JSON.parse(submission.payload);
    } catch {
      throw new ApiError(500, 'This submission payload could not be read');
    }

    let current = null;
    if (submission.resource_id) {
      const Model = models[SUBMITTABLE[submission.resource]];
      current = await Model.findByPk(submission.resource_id);
    }

    const live = current ? snapshotOf(current) : {};

    const diff = Object.keys(payload).map((field) => ({
      field,
      from: current ? live[field] ?? null : null,
      to: payload[field],
      changed: JSON.stringify(live[field] ?? null) !== JSON.stringify(payload[field] ?? null),
    }));

    res.json({
      data: {
        ...submission.get({ plain: true }),
        payload,
        isNewRecord: !submission.resource_id,
        diff,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/submissions/:id/review
 * Body: { decision: 'approve' | 'reject', note }
 *
 * Approving applies the payload to the live record inside a transaction and
 * snapshots the previous state, so an approval can be rolled back like any
 * other change.
 */
export const reviewSubmission = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const { decision, note } = req.body || {};

    if (!['approve', 'reject'].includes(decision)) {
      throw new ApiError(400, "decision must be 'approve' or 'reject'");
    }

    // A rejection without a reason gives the submitter nothing to act on.
    if (decision === 'reject' && !String(note || '').trim()) {
      throw new ApiError(400, 'A note explaining the decision is required when rejecting');
    }

    const submission = await ContentSubmission.findByPk(req.params.id, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!submission) throw new ApiError(404, 'Submission not found');

    if (submission.status !== 'submitted') {
      throw new ApiError(
        409,
        `This submission is "${submission.status}" and is no longer awaiting review`,
      );
    }

    let appliedTo = null;
    let preApproval = null;

    if (decision === 'approve') {
      const payload = JSON.parse(submission.payload);
      const Model = models[SUBMITTABLE[submission.resource]];

      if (submission.resource_id) {
        const row = await Model.findByPk(submission.resource_id, { transaction: tx });
        if (!row) {
          throw new ApiError(
            409,
            'The target record no longer exists, so this submission cannot be applied',
          );
        }

        // Detached copy — get({plain:true}) aliases dataValues.
        preApproval = snapshotOf(row);
        await row.update(payload, { transaction: tx });
        appliedTo = row.id;
      } else {
        const created = await Model.create(payload, { transaction: tx });
        appliedTo = created.id;
        submission.resource_id = created.id;
      }
    }

    submission.status = decision === 'approve' ? 'approved' : 'rejected';
    submission.reviewed_by = req.user.id;
    submission.reviewer_email = req.user.email;
    submission.reviewed_at = new Date();
    submission.review_note = note ? String(note).slice(0, 500) : null;
    await submission.save({ transaction: tx });

    await tx.commit();

    // Version history for an approved edit, recorded after commit.
    if (decision === 'approve' && preApproval && VERSIONED_RESOURCES[submission.resource]) {
      const Model = models[SUBMITTABLE[submission.resource]];
      await recordVersion({
        resource: submission.resource,
        resourceId: appliedTo,
        before: preApproval,
        after: await Model.findByPk(appliedTo),
        changeType: 'update',
        user: req.user,
      });
    }

    // Let the submitter know either way.
    if (submission.submitter_email) {
      const payload = JSON.parse(submission.payload);
      await sendTemplate('contentReviewed', {
        to: submission.submitter_email,
        name: submission.submitter_email,
        resource: submission.resource,
        title: payload.title || payload.name || `#${submission.resource_id}`,
        approved: decision === 'approve',
        reason: submission.review_note,
      });
    }

    res.json({
      data: {
        id: submission.id,
        status: submission.status,
        appliedTo,
        message:
          decision === 'approve'
            ? 'Submission approved and published.'
            : 'Submission returned to the author.',
      },
    });
  } catch (error) {
    await tx.rollback().catch(() => {});
    next(error);
  }
};

/** POST /api/admin/submissions/:id/withdraw — submitter cancels their own. */
export const withdrawSubmission = async (req, res, next) => {
  try {
    const submission = await ContentSubmission.findByPk(req.params.id);
    if (!submission) throw new ApiError(404, 'Submission not found');

    const isOwner = submission.submitted_by === req.user.id;
    const isAdmin = ['admin', 'super_admin'].includes(req.user.role);

    if (!isOwner && !isAdmin) {
      throw new ApiError(403, 'You may only withdraw your own submissions');
    }

    if (!['draft', 'submitted'].includes(submission.status)) {
      throw new ApiError(409, `A "${submission.status}" submission cannot be withdrawn`);
    }

    submission.status = 'withdrawn';
    await submission.save();

    res.json({ data: { id: submission.id, status: submission.status } });
  } catch (error) {
    next(error);
  }
};
