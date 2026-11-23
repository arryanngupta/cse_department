#!/usr/bin/env node
/**
 * Populate research_authors from the existing free-text author columns.
 *
 * `research.faculty`, `research.authors` and `research.inventors` hold strings
 * such as "Dr. Jayprakash Kar, Dept. of CSE, The LNMIIT, Jaipur" or
 * "Aryan Gupta". This script splits them, matches each fragment against the
 * `people` table, and creates authorship rows.
 *
 * Matching names is inherently fuzzy, so the script is DRY RUN BY DEFAULT: it
 * prints what it would create and changes nothing. Review the output, then
 * re-run with --apply.
 *
 *   node scripts/backfill-research-authors.mjs            # preview
 *   node scripts/backfill-research-authors.mjs --apply    # write
 *   node scripts/backfill-research-authors.mjs --apply --include-external
 *
 * Fragments that match no person are skipped unless --include-external is
 * passed, in which case they are stored as external_name. They are skipped by
 * default because the source text frequently contains affiliations
 * ("Dept. of CSE", "The LNMIIT, Jaipur") rather than people, and those would
 * otherwise be recorded as authors.
 *
 * Re-running is safe: existing links are detected and left alone.
 */

import { sequelize } from '../src/config/database.js';
import { Research, People, ResearchAuthor } from '../src/db/models/index.js';

const APPLY = process.argv.includes('--apply');
const INCLUDE_EXTERNAL = process.argv.includes('--include-external');

/** Role to record, based on what kind of research record this is. */
const roleForCategory = (category) => {
  switch (category) {
    case 'Patent':
      return 'inventor';
    case 'Project':
      return 'investigator';
    case 'Collaboration':
      return 'collaborator';
    default:
      return 'author';
  }
};

/**
 * Fragments that are affiliations or boilerplate rather than people.
 * Checked as whole-ish substrings against the lowercased fragment.
 */
const NON_PERSON_PATTERNS = [
  /\bdept\b/, /\bdepartment\b/, /\bschool\b/, /\binstitute\b/, /\buniversity\b/,
  /\bcollege\b/, /\blnmiit\b/, /\bjaipur\b/, /\bindia\b/, /\bet\s*al\b/,
  /\bcse\b/, /\bece\b/, /^\s*and\s*$/, /^\d+$/,
];

const looksLikeAffiliation = (fragment) =>
  NON_PERSON_PATTERNS.some((re) => re.test(fragment.toLowerCase()));

/** Drop honorifics and punctuation so "Dr. Rajbir Kaur" matches "Rajbir Kaur". */
const normalizeName = (name) =>
  String(name || '')
    .toLowerCase()
    .replace(/\b(dr|prof|professor|mr|mrs|ms|shri|smt)\.?\s+/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Split a free-text author string into candidate name fragments. */
const splitAuthors = (text) =>
  String(text || '')
    .split(/[,;&]|\band\b|\n/)
    .map((s) => s.trim())
    .filter(Boolean);

const main = async () => {
  await sequelize.authenticate();

  const people = await People.findAll({ attributes: ['id', 'name'] });
  const peopleByNormalized = new Map(
    people.map((p) => [normalizeName(p.name), p]),
  );

  const research = await Research.findAll({
    attributes: ['id', 'title', 'category', 'faculty', 'authors', 'inventors'],
    include: [{ model: ResearchAuthor, as: 'authorLinks', required: false }],
  });

  const planned = [];
  const unmatched = [];
  let alreadyLinked = 0;

  for (const record of research) {
    const role = roleForCategory(record.category);
    const existing = new Set(
      (record.authorLinks || []).map((l) => `${l.person_id}:${l.role}`),
    );

    // All three columns can carry names; de-duplicate across them.
    const fragments = [
      ...splitAuthors(record.faculty),
      ...splitAuthors(record.authors),
      ...splitAuthors(record.inventors),
    ];

    const seen = new Set();
    let order = 0;

    for (const fragment of fragments) {
      const normalized = normalizeName(fragment);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);

      if (looksLikeAffiliation(fragment)) continue;

      const match = peopleByNormalized.get(normalized);

      if (match) {
        if (existing.has(`${match.id}:${role}`)) {
          alreadyLinked += 1;
          continue;
        }
        planned.push({
          research_id: record.id,
          person_id: match.id,
          external_name: null,
          author_order: order++,
          role,
          _title: record.title,
          _name: match.name,
        });
      } else {
        unmatched.push({ research_id: record.id, title: record.title, fragment });
        if (INCLUDE_EXTERNAL) {
          planned.push({
            research_id: record.id,
            person_id: null,
            external_name: fragment.slice(0, 255),
            author_order: order++,
            role,
            _title: record.title,
            _name: `${fragment} (external)`,
          });
        }
      }
    }
  }

  console.log(`\nResearch records scanned: ${research.length}`);
  console.log(`Department members in directory: ${people.length}`);
  console.log(`Links already present: ${alreadyLinked}`);
  console.log(`Links to create: ${planned.length}\n`);

  for (const p of planned) {
    console.log(`  [${p.role}] ${p._name}  ->  "${String(p._title).slice(0, 52)}"`);
  }

  if (unmatched.length) {
    console.log(`\nUnmatched name fragments (${unmatched.length}):`);
    for (const u of unmatched) {
      console.log(`  "${u.fragment}"  in  "${String(u.title).slice(0, 44)}"`);
    }
    console.log(
      INCLUDE_EXTERNAL
        ? '\n  (stored as external_name because --include-external was passed)'
        : '\n  Skipped. Re-run with --include-external to record them as\n' +
            '  external co-authors, or add the person to the directory first.',
    );
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to create these links.\n');
    await sequelize.close();
    return;
  }

  if (!planned.length) {
    console.log('\nNothing to do.\n');
    await sequelize.close();
    return;
  }

  // One transaction: a partial author list is worse than none.
  const tx = await sequelize.transaction();
  try {
    await ResearchAuthor.bulkCreate(
      planned.map(({ _title, _name, ...row }) => row),
      { transaction: tx, validate: true },
    );
    await tx.commit();
    console.log(`\nCreated ${planned.length} authorship link(s).\n`);
  } catch (error) {
    await tx.rollback();
    console.error(`\nFailed, rolled back: ${error.message}\n`);
    process.exitCode = 1;
  }

  await sequelize.close();
};

main().catch((error) => {
  console.error(`Backfill failed: ${error.message}`);
  process.exit(1);
});
