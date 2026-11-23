// backend/src/controllers/importController.js
//
// CSV import with a mandatory preview step.
//
// Imports are the easiest way to damage a dataset at scale, so this is a
// two-phase flow: `preview` validates and reports without writing anything,
// and `apply` commits in a single transaction. Nothing is ever partially
// imported — either every accepted row lands or none does.

import { Op } from 'sequelize';
import * as models from '../db/models/index.js';
import { sequelize } from '../db/models/index.js';
import { ApiError } from '../middleware/errorHandler.js';
import { parseCsvToObjects } from '../utils/csvParse.js';
import { toCsv } from '../utils/csv.js';
import { generateSlug } from '../utils/slugUtils.js';

const MAX_ROWS = 1000;

/**
 * Importable entities.
 *
 * `unique` names the column used for duplicate detection; `required` fields
 * must be non-empty; `fields` is the full accepted column set.
 */
const IMPORTABLE = {
  people: {
    model: 'People',
    unique: 'email',
    required: ['name'],
    fields: [
      'name', 'designation', 'email', 'phone', 'webpage', 'research_areas',
      'summary', 'bio', 'department', 'education', 'person_type', 'order',
    ],
    sample: {
      name: 'Dr. Example Person',
      designation: 'Assistant Professor',
      email: 'example.person@lnmiit.ac.in',
      phone: '0141 268 8090',
      webpage: 'https://example.com',
      research_areas: 'Machine Learning, Computer Vision',
      summary: 'One-line summary shown on the profile card.',
      bio: 'Longer biography text.',
      department: 'Computer Science & Engineering',
      education: 'PhD, Example University',
      person_type: 'Faculty',
      order: '10',
    },
  },

  directory: {
    model: 'DirectoryEntry',
    unique: 'email',
    required: ['name'],
    fields: ['name', 'role', 'phone', 'email', 'location'],
    sample: {
      name: 'Example Contact',
      role: 'Office Superintendent',
      phone: '0141 268 8090',
      email: 'contact@lnmiit.ac.in',
      location: 'Academic Block, Room 101',
    },
  },

  research: {
    model: 'Research',
    unique: 'title',
    required: ['title', 'category'],
    fields: [
      'title', 'category', 'description', 'faculty', 'authors', 'journal',
      'year', 'funding_agency', 'funding_amount', 'duration', 'status',
      'link', 'inventors', 'application_no', 'patent_status',
      'collaboration_org', 'display_order',
    ],
    sample: {
      title: 'Example Publication Title',
      category: 'Publication',
      description: 'Short description.',
      authors: 'A. Author, B. Author',
      journal: 'Journal of Examples',
      year: '2026',
      link: 'https://doi.org/example',
      display_order: '0',
    },
  },

  achievements: {
    model: 'Achievement',
    unique: 'title',
    required: ['title'],
    fields: ['title', 'students', 'description', 'link', 'category'],
    sample: {
      title: 'Example Achievement',
      students: 'Student One, Student Two',
      description: 'What was achieved.',
      link: 'https://example.com',
      category: 'student',
    },
  },
};

const assertImportable = (resource) => {
  if (!IMPORTABLE[resource]) {
    throw new ApiError(
      400,
      `"${resource}" cannot be imported. Importable: ${Object.keys(IMPORTABLE).join(', ')}`,
    );
  }
  return IMPORTABLE[resource];
};

/** Enum columns are validated here so a bad value fails preview, not the insert. */
const ENUM_VALUES = {
  category: {
    research: ['Publication', 'Project', 'Patent', 'Collaboration'],
  },
  person_type: {
    people: ['Faculty', 'Staff', 'Research Scholar', 'Alumni'],
  },
  status: {
    research: ['Ongoing', 'In Progress', 'Completed', 'Published'],
  },
};

/** GET /api/admin/import/:resource/template — a ready-to-fill CSV. */
export const downloadTemplate = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const config = assertImportable(resource);

    const columns = config.fields.map((f) => ({
      key: f,
      label: f + (config.required.includes(f) ? ' (required)' : ''),
    }));

    // One example row, so the expected format is self-evident.
    const csv = toCsv(columns, [config.sample]);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${resource}-import-template.csv"`,
    );
    res.send(csv);
  } catch (error) {
    next(error);
  }
};

/** Validate rows and classify each as insert / duplicate / error. */
const analyse = async (resource, config, rows) => {
  const Model = models[config.model];
  const known = new Set(Object.keys(Model.getAttributes()));

  // Pre-load existing unique values in one query rather than per row.
  const uniqueValues = rows
    .map((r) => String(r[config.unique] || '').trim().toLowerCase())
    .filter(Boolean);

  const existing = new Set();
  if (uniqueValues.length) {
    const found = await Model.findAll({
      where: { [config.unique]: { [Op.in]: [...new Set(uniqueValues)] } },
      attributes: [config.unique],
      raw: true,
    });
    for (const row of found) {
      existing.add(String(row[config.unique] || '').toLowerCase());
    }
  }

  const seenInFile = new Set();
  const toInsert = [];
  const duplicates = [];
  const errors = [];

  for (const row of rows) {
    const problems = [];

    for (const field of config.required) {
      if (!String(row[field] || '').trim()) problems.push(`${field} is required`);
    }

    // Validate enums up front; otherwise the row fails only at INSERT time,
    // after the transaction has already started.
    for (const [field, byResource] of Object.entries(ENUM_VALUES)) {
      const allowed = byResource[resource];
      const value = String(row[field] || '').trim();
      if (allowed && value && !allowed.includes(value)) {
        problems.push(`${field} must be one of: ${allowed.join(', ')}`);
      }
    }

    if (row[config.unique] && config.unique === 'email') {
      const email = String(row.email).trim();
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        problems.push('email is not a valid address');
      }
    }

    if (row.__warning) problems.push(row.__warning);

    if (problems.length) {
      errors.push({ line: row.__line, problems, data: row });
      continue;
    }

    const key = String(row[config.unique] || '').trim().toLowerCase();

    if (key && existing.has(key)) {
      duplicates.push({ line: row.__line, reason: `already in the database`, key, data: row });
      continue;
    }

    if (key && seenInFile.has(key)) {
      duplicates.push({ line: row.__line, reason: 'repeated in this file', key, data: row });
      continue;
    }

    if (key) seenInFile.add(key);

    // Keep only declared columns.
    const clean = {};
    for (const field of config.fields) {
      if (!known.has(field)) continue;
      const value = String(row[field] ?? '').trim();
      if (value !== '') clean[field] = value;
    }

    toInsert.push({ line: row.__line, data: clean });
  }

  return { toInsert, duplicates, errors };
};

/**
 * POST /api/admin/import/:resource/preview
 * Body: { csv: "<file contents>" }
 *
 * Writes nothing. Reports exactly what an apply would do.
 */
export const previewImport = async (req, res, next) => {
  try {
    const { resource } = req.params;
    const config = assertImportable(resource);

    const csv = req.body?.csv;
    if (!csv || typeof csv !== 'string') {
      throw new ApiError(400, 'Send the CSV file contents as a "csv" string');
    }

    const { headers, rows, errors: parseErrors } = parseCsvToObjects(csv);

    if (parseErrors.length) throw new ApiError(400, parseErrors.join('; '));

    if (rows.length > MAX_ROWS) {
      throw new ApiError(
        400,
        `This file has ${rows.length} rows; the limit is ${MAX_ROWS}. Split it into smaller files.`,
      );
    }

    const unknownColumns = headers.filter(
      (h) => h && !config.fields.includes(h) && h !== '__line',
    );

    const { toInsert, duplicates, errors } = await analyse(resource, config, rows);

    res.json({
      data: {
        resource,
        totalRows: rows.length,
        willInsert: toInsert.length,
        willSkipDuplicates: duplicates.length,
        rowsWithErrors: errors.length,
        unknownColumns,
        // Capped so a 1000-row file does not produce an unreadable response.
        preview: toInsert.slice(0, 20),
        duplicates: duplicates.slice(0, 50),
        errors: errors.slice(0, 50),
        note:
          'Nothing has been written. POST the same CSV to .../apply to commit the importable rows.',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/import/:resource/apply
 * Body: { csv, skipDuplicates (default true) }
 *
 * Commits in one transaction. Rows with errors are never imported; duplicates
 * are skipped rather than overwriting existing records.
 */
export const applyImport = async (req, res, next) => {
  const tx = await sequelize.transaction();
  try {
    const { resource } = req.params;
    const config = assertImportable(resource);

    const csv = req.body?.csv;
    if (!csv || typeof csv !== 'string') {
      throw new ApiError(400, 'Send the CSV file contents as a "csv" string');
    }

    const { rows, errors: parseErrors } = parseCsvToObjects(csv);
    if (parseErrors.length) throw new ApiError(400, parseErrors.join('; '));

    if (rows.length > MAX_ROWS) {
      throw new ApiError(400, `This file has ${rows.length} rows; the limit is ${MAX_ROWS}.`);
    }

    const { toInsert, duplicates, errors } = await analyse(resource, config, rows);

    // An import that silently drops half the file is worse than one that
    // refuses: the operator should fix the rows and retry.
    if (errors.length && req.body?.allowPartial !== true) {
      throw new ApiError(
        400,
        `${errors.length} row(s) have errors. Fix them, or resend with "allowPartial": true to import only the valid rows.`,
      );
    }

    if (!toInsert.length) {
      await tx.rollback();
      return res.json({
        data: {
          imported: 0,
          skippedDuplicates: duplicates.length,
          rowsWithErrors: errors.length,
          message: 'Nothing to import.',
        },
      });
    }

    const Model = models[config.model];

    // People need a slug, which the normal create path generates.
    const payload = toInsert.map(({ data }) => {
      if (resource === 'people' && !data.slug) {
        return { ...data, slug: generateSlug(data.name, 'person') };
      }
      return data;
    });

    const created = await Model.bulkCreate(payload, {
      transaction: tx,
      validate: true,
    });

    await tx.commit();

    res.status(201).json({
      data: {
        imported: created.length,
        skippedDuplicates: duplicates.length,
        rowsWithErrors: errors.length,
        errors: errors.slice(0, 50),
        message: `Imported ${created.length} ${resource} record(s).`,
      },
    });
  } catch (error) {
    await tx.rollback().catch(() => {});
    next(error);
  }
};

/** GET /api/admin/import — what can be imported, and with which columns. */
export const importOptions = async (req, res) => {
  res.json({
    data: Object.entries(IMPORTABLE).map(([resource, config]) => ({
      resource,
      uniqueBy: config.unique,
      required: config.required,
      fields: config.fields,
      templateUrl: `/api/admin/import/${resource}/template`,
    })),
    meta: { maxRows: MAX_ROWS },
  });
};
