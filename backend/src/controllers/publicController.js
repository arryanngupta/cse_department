// src/controllers/publicController.js

import { Op } from 'sequelize';
import { parsePagination, buildMeta } from '../utils/pagination.js';
import { servableFileOrNull } from '../utils/uploadPath.js';
import { escapeLike } from '../utils/sql.js';
import {
  Slider,
  People,
  Program,
  News,
  Event,
  Achievement,
  Newsletter,
  DirectoryEntry,
  InfoBlock,
  Research,
  ResearchAuthor,
  Facility,
  ProgramSection,
  CurriculumSemester,
  CurriculumCourse,
  ProgramOutcome,
  SectionContent,
  Opportunity
} from '../db/models/index.js';

// 🔥 NEW: Faculty profile normalizer
import { normalizeFacultyProfile } from '../utils/normalizeFacultyProfile.js';

/**
 * Public controllers for the website.
 */

/* ======================= SLIDERS ======================= */
export const getSliders = async (req, res, next) => {
  try {
    const sliders = await Slider.findAll({
      where: { isActive: true },
      order: [['order', 'ASC']],
      attributes: ['id', 'image_path', 'caption', 'order']
    });

    res.json({ data: sliders });
  } catch (error) {
    next(error);
  }
};

/* ======================= PEOPLE LIST ======================= */
export const getPeople = async (req, res, next) => {
  try {
    const { designation, person_type, area, q } = req.query;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 20 });

    const where = {};

    if (designation) where.designation = { [Op.like]: `%${escapeLike(designation)}%` };
    if (person_type) where.person_type = person_type;
    if (area) where.research_areas = { [Op.like]: `%${escapeLike(area)}%` };

    if (q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${escapeLike(q)}%` } },
        { designation: { [Op.like]: `%${escapeLike(q)}%` } },
        { research_areas: { [Op.like]: `%${escapeLike(q)}%` } }
      ];
    }

    const { count, rows } = await People.findAndCountAll({
      where,
      order: [['order', 'ASC'], ['name', 'ASC']],
      limit,
      offset
    });

    res.json({ data: rows, meta: buildMeta(count, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

/* ======================= FACULTY PROFILE ======================= */
/**
 * GET /api/public/people/:slug
 * LNMIIT-style Faculty Profile API
 */
export const getPersonBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const person = await People.findOne({
      where: { slug },
      attributes: [
        'id',
        'name',
        'slug',
        'designation',
        'email',
        'phone',
        'webpage',
        'summary',
        'photo_path',
        'research_areas',
        'bio',
        'joining_date',
        'department',
        'education',
        'publications',
        'workshops',
        'profile_sections'
      ]
    });

    if (!person) {
      return res.status(404).json({ error: 'Faculty member not found' });
    }

    // NORMALIZE to frontend-ready LNMIIT schema
    const profile = normalizeFacultyProfile(person);

    // Research this person is relationally linked to, newest first. Kept as a
    // separate query rather than an include so the normalizer above keeps
    // seeing exactly the shape it expects.
    const links = await ResearchAuthor.findAll({
      where: { person_id: person.id },
      include: [
        {
          model: Research,
          as: 'research',
          required: true,
          attributes: ['id', 'title', 'category', 'journal', 'year', 'link', 'status'],
        },
      ],
      order: [['author_order', 'ASC']],
    });

    const linkedResearch = links
      .map((link) => {
        const r = link.research;
        return {
          id: r.id,
          title: r.title,
          category: r.category,
          journal: r.journal,
          year: r.year,
          link: r.link,
          status: r.status,
          role: link.role,
          url: `/research/${r.id}`,
        };
      })
      .sort((a, b) => String(b.year || '').localeCompare(String(a.year || '')));

    res.json({ data: { ...profile, linkedResearch } });
  } catch (error) {
    next(error);
  }
};

/* ======================= PROGRAMS ======================= */
export const getPrograms = async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 6 });

    const { count, rows } = await Program.findAndCountAll({
      order: [
        ['level', 'ASC'],
        ['display_order', 'ASC'],
        ['name', 'ASC']
      ],
      limit,
      offset
    });

    // Null out a curriculum path whose file is not on disk, so the Programs
    // page hides its download button with the `{path && ...}` guard it already
    // has, rather than offering a link that 404s.
    const programs = rows.map((row) => {
      const plain = row.get({ plain: true });
      plain.curriculum_pdf_path = servableFileOrNull(plain.curriculum_pdf_path);
      return plain;
    });

    res.json({ data: programs, meta: buildMeta(count, { page, limit }) });

  } catch (error) {
    next(error);
  }
};

/* ======================= PROGRAM DETAILS ======================= */
export const getProgramDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    const program = await Program.findByPk(id, {
      include: [
        {
          model: ProgramSection,
          as: 'sections',
          separate: true,
          order: [['display_order', 'ASC']],
          include: [
            {
              model: CurriculumSemester,
              as: 'semesters',
              separate: true,
              order: [['display_order', 'ASC']],
              include: [
                {
                  model: CurriculumCourse,
                  as: 'courses',
                  separate: true,
                  order: [['display_order', 'ASC']]
                }
              ]
            },
            {
              model: ProgramOutcome,
              as: 'outcomes',
              separate: true,
              order: [['display_order', 'ASC']]
            },
            {
              model: SectionContent,
              as: 'content'
            }
          ]
        }
      ]
    });

    if (!program) {
      return res.status(404).json({ error: 'Program not found' });
    }

    const cleanProgram = {
      id: program.id,
      name: program.name,
      short_name: program.short_name,
      level: program.level,
      description: program.description,
      overview: program.overview,
      duration: program.duration,
      total_credits: program.total_credits,
      // Null when the stored file is missing, so the UI hides its download
      // button instead of offering a link that 404s.
      curriculum_pdf_path: servableFileOrNull(program.curriculum_pdf_path),
      sections: (program.sections || []).map(s => ({
        id: s.id,
        title: s.title,
        section_type: s.section_type,
        display_order: s.display_order,
        is_expanded: !!s.is_expanded,
        content: s.content ? s.content.content_html : null,
        outcomes: s.outcomes || [],
        semesters: s.semesters || []
      }))
    };

    res.json({ data: cleanProgram });
  } catch (error) {
    next(error);
  }
};

/* ======================= NEWS / EVENTS / OTHERS ======================= */

export const getNews = async (req, res, next) => {
  try {
    const { published = '1' } = req.query;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 10 });

    const where = published === '1' ? { isPublished: true } : {};

    const { count, rows } = await News.findAndCountAll({
      where,
      order: [['date', 'DESC']],
      limit,
      offset
    });

    res.json({ data: rows, meta: buildMeta(count, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

export const getNewsById = async (req, res, next) => {
  try {
    const news = await News.findOne({
      where: { id: req.params.id, isPublished: true }
    });

    if (!news) return res.status(404).json({ error: 'News not found' });
    res.json({ data: news });
  } catch (error) {
    next(error);
  }
};

export const getEvents = async (req, res, next) => {
  try {
    const { q } = req.query;
    const { page, limit, offset } = parsePagination(req.query, { defaultLimit: 6 });

    const where = { isPublished: true };

    if (q) {
      where[Op.or] = [
        { title: { [Op.like]: `%${escapeLike(q)}%` } },
        { description: { [Op.like]: `%${escapeLike(q)}%` } }
      ];
    }

    const { count, rows } = await Event.findAndCountAll({
      where,
      order: [["startsAt", "DESC"]],
      limit,
      offset
    });

    res.json({ data: rows, meta: buildMeta(count, { page, limit }) });
  } catch (e) {
    next(e);
  }
};

export const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findOne({
      where: {
        id: req.params.id,
        isPublished: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    res.json({ data: event });
  } catch (error) {
    next(error);
  }
};

export const getAchievements = async (req, res, next) => {
  try {
    const { category } = req.query;

    const where = { isPublished: true };
    if (category) where.category = category;

    const achievements = await Achievement.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    res.json({ data: achievements });
  } catch (error) {
    next(error);
  }
};

export const getAchievementById = async (req, res, next) => {
  try {
    const achievement = await Achievement.findOne({
      where: { id: req.params.id, isPublished: true },
    });

    if (!achievement) {
      return res.status(404).json({ error: "Achievement not found" });
    }

    res.json({ data: achievement });
  } catch (error) {
    next(error);
  }
};

export const getNewsletters = async (req, res, next) => {
  try {
    const newsletters = await Newsletter.findAll({
      order: [['issueDate', 'DESC']]
    });

    res.json({ data: newsletters });
  } catch (error) {
    next(error);
  }
};

export const getDirectory = async (req, res, next) => {
  try {
    const directory = await DirectoryEntry.findAll({
      order: [['name', 'ASC']]
    });

    res.json({ data: directory });
  } catch (error) {
    next(error);
  }
};

export const getInfoBlock = async (req, res, next) => {
  try {
    const infoBlock = await InfoBlock.findOne({
      where: { key: req.params.key }
    });

    if (!infoBlock) return res.status(404).json({ error: 'Info block not found' });
    res.json({ data: infoBlock });
  } catch (error) {
    next(error);
  }
};

/* ======================= RESEARCH ======================= */

export const getResearch = async (req, res, next) => {
  try {
    const research = await Research.findAll({
      order: [
        ['display_order', 'ASC'],
        ['createdAt', 'DESC']
      ]
    });

    res.json({ data: research });
  } catch (error) {
    next(error);
  }
};

export const getResearchById = async (req, res, next) => {
  try {
    const research = await Research.findByPk(req.params.id, {
      include: [
        {
          model: ResearchAuthor,
          as: 'authorLinks',
          required: false,
          // Only the fields needed to render a linked author name.
          include: [
            {
              model: People,
              as: 'person',
              required: false,
              attributes: ['id', 'name', 'slug', 'designation'],
            },
          ],
        },
      ],
      order: [[{ model: ResearchAuthor, as: 'authorLinks' }, 'author_order', 'ASC']],
    });

    if (!research) {
      return res.status(404).json({ error: 'Research not found' });
    }

    const plain = research.get({ plain: true });

    // Flatten to one list the UI can render directly: department members carry
    // a slug to link to, external co-authors do not.
    const contributors = (plain.authorLinks || []).map((link) => ({
      name: link.person?.name || link.external_name,
      slug: link.person?.slug || null,
      designation: link.person?.designation || null,
      role: link.role,
      order: link.author_order,
      internal: Boolean(link.person_id),
    }));

    delete plain.authorLinks;

    res.json({ data: { ...plain, contributors } });
  } catch (error) {
    next(error);
  }
};

export const getFacilities = async (req, res, next) => {
  try {
    const { category } = req.query;

    const where = { is_active: true };

    // 🔥 FILTER BY CATEGORY
    if (category) {
      where.category = category;
    }

    const facilities = await Facility.findAll({
      where,
      order: [['display_order', 'ASC']],
    });

    res.json({ data: facilities });
  } catch (error) {
    next(error);
  }
};

export const getFacilityById = async (req, res, next) => {
  try {
    const facility = await Facility.findByPk(req.params.id);
    if (!facility) return res.status(404).json({ error: 'Facility not found' });
    res.json({ data: facility });
  } catch (error) {
    next(error);
  }
};

// Opportunity
export const getOpportunities = async (req, res, next) => {
  try {
    const items = await Opportunity.findAll({
      where: { is_active: true },
      order: [['page_group', 'ASC'], ['display_order', 'ASC'], ['id', 'ASC']]
    });

    res.json({ data: items });
  } catch (error) {
    console.error("❌ GET Opportunities Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getOpportunityById = async (req, res, next) => {
  try {
    const item = await Opportunity.findOne({
      where: { id: req.params.id, is_active: true }
    });

    if (!item) {
      return res.status(404).json({ error: 'Opportunity not found' });
    }

    res.json({ data: item });
  } catch (error) {
    next(error);
  }
};