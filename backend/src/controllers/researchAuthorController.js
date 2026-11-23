// backend/src/controllers/researchAuthorController.js
//
// Admin management of the research <-> people authorship links.

import { Research, People, ResearchAuthor } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';

const VALID_ROLES = ['author', 'inventor', 'investigator', 'collaborator'];

/** GET /api/admin/research/:id/authors */
export const listResearchAuthors = async (req, res, next) => {
  try {
    const research = await Research.findByPk(req.params.id, {
      attributes: ['id', 'title', 'category'],
    });
    if (!research) throw new ApiError(404, 'Research not found');

    const links = await ResearchAuthor.findAll({
      where: { research_id: research.id },
      include: [
        {
          model: People,
          as: 'person',
          required: false,
          attributes: ['id', 'name', 'slug', 'designation'],
        },
      ],
      order: [['author_order', 'ASC']],
    });

    res.json({
      data: links.map((link) => ({
        id: link.id,
        person_id: link.person_id,
        name: link.person?.name || link.external_name,
        slug: link.person?.slug || null,
        external_name: link.external_name,
        role: link.role,
        author_order: link.author_order,
        internal: Boolean(link.person_id),
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/research/:id/authors
 * Body: { person_id } or { external_name }, plus optional role / author_order.
 */
export const addResearchAuthor = async (req, res, next) => {
  try {
    const research = await Research.findByPk(req.params.id, { attributes: ['id'] });
    if (!research) throw new ApiError(404, 'Research not found');

    const { person_id: personId, external_name: externalName, role, author_order: order } =
      req.body || {};

    if (!personId && !externalName) {
      throw new ApiError(400, 'Provide either person_id or external_name');
    }
    if (personId && externalName) {
      throw new ApiError(
        400,
        'Provide person_id for a department member or external_name for an outside author, not both',
      );
    }
    if (role && !VALID_ROLES.includes(role)) {
      throw new ApiError(400, `role must be one of: ${VALID_ROLES.join(', ')}`);
    }

    if (personId) {
      const person = await People.findByPk(personId, { attributes: ['id'] });
      if (!person) throw new ApiError(400, 'person_id does not match anyone in the directory');
    }

    // Append to the end unless an explicit position was given.
    let resolvedOrder = Number.parseInt(order, 10);
    if (!Number.isFinite(resolvedOrder)) {
      resolvedOrder = await ResearchAuthor.count({ where: { research_id: research.id } });
    }

    const link = await ResearchAuthor.create({
      research_id: research.id,
      person_id: personId || null,
      external_name: externalName || null,
      role: role || 'author',
      author_order: resolvedOrder,
    });

    res.status(201).json({ data: link });
  } catch (error) {
    // The unique index on (research_id, person_id, role) surfaces as a
    // SequelizeUniqueConstraintError; the shared handler turns that into a 409
    // already, so it only needs a clearer message.
    if (error.name === 'SequelizeUniqueConstraintError') {
      return next(
        new ApiError(409, 'That person is already linked to this record in that role'),
      );
    }
    next(error);
  }
};

/** PUT /api/admin/research/authors/:linkId — reorder or change role. */
export const updateResearchAuthor = async (req, res, next) => {
  try {
    const link = await ResearchAuthor.findByPk(req.params.linkId);
    if (!link) throw new ApiError(404, 'Author link not found');

    const { role, author_order: order } = req.body || {};

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        throw new ApiError(400, `role must be one of: ${VALID_ROLES.join(', ')}`);
      }
      link.role = role;
    }

    if (order !== undefined) {
      const parsed = Number.parseInt(order, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(400, 'author_order must be a non-negative integer');
      }
      link.author_order = parsed;
    }

    await link.save();
    res.json({ data: link });
  } catch (error) {
    next(error);
  }
};

/** DELETE /api/admin/research/authors/:linkId */
export const removeResearchAuthor = async (req, res, next) => {
  try {
    const link = await ResearchAuthor.findByPk(req.params.linkId);
    if (!link) throw new ApiError(404, 'Author link not found');

    await link.destroy();
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
