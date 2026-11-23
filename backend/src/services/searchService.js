// backend/src/services/searchService.js
//
// One search implementation shared by the public search API and the AI
// assistant's retrieval step, so both see exactly the same corpus and obey the
// same publication rules. If a record is a draft, neither can surface it.

import { Op } from 'sequelize';
import { escapeLike } from '../utils/sql.js';
import {
  People,
  Program,
  News,
  Event,
  Research,
  Facility,
  Achievement,
  Newsletter,
  DirectoryEntry,
  Opportunity,
} from '../db/models/index.js';

/** Strip HTML so snippets from rich-text bodies read as plain prose. */
const stripHtml = (value) =>
  String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Build a short excerpt centred on the first match, so the user can see why a
 * result matched rather than just the opening words of the field.
 */
const makeSnippet = (text, term, length = 180) => {
  const clean = stripHtml(text);
  if (!clean) return '';
  const at = clean.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return clean.slice(0, length) + (clean.length > length ? '…' : '');
  const start = Math.max(0, at - 60);
  const end = Math.min(clean.length, start + length);
  return (
    (start > 0 ? '…' : '') + clean.slice(start, end) + (end < clean.length ? '…' : '')
  );
};

/**
 * Relevance score. Title hits outrank body hits, and whole-word hits outrank
 * substring hits, so searching "AI" does not rank "maintain" above a faculty
 * member whose research area is literally "AI".
 */
const scoreOf = (term, title, body) => {
  const t = String(title || '').toLowerCase();
  const b = stripHtml(body).toLowerCase();
  const q = term.toLowerCase();
  const word = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);

  let score = 0;
  if (t === q) score += 100;
  else if (t.startsWith(q)) score += 60;
  else if (word.test(t)) score += 45;
  else if (t.includes(q)) score += 25;

  if (word.test(b)) score += 10;
  else if (b.includes(q)) score += 5;

  return score;
};

/**
 * The searchable corpus.
 *
 * `where` carries each model's publication rule. Tables with an isPublished or
 * is_active column are filtered to published rows only — that is what keeps
 * admin drafts out of both public search results and the AI assistant's
 * context. Tables without such a column (people, programs, directory) are
 * already fully public on the website.
 */
const SOURCES = [
  {
    type: 'faculty',
    label: 'People',
    model: People,
    fields: ['name', 'designation', 'research_areas', 'summary', 'bio', 'department', 'education'],
    titleField: 'name',
    bodyFields: ['research_areas', 'summary', 'bio'],
    url: (r) => `/people/${r.slug}`,
    meta: (r) => ({ designation: r.designation, personType: r.person_type }),
  },
  {
    type: 'program',
    label: 'Programs',
    model: Program,
    fields: ['name', 'short_name', 'description', 'overview', 'level'],
    titleField: 'name',
    bodyFields: ['overview', 'description'],
    url: () => '/programs',
    meta: (r) => ({ level: r.level, duration: r.duration }),
  },
  {
    type: 'news',
    label: 'News',
    model: News,
    fields: ['title', 'summary', 'body'],
    titleField: 'title',
    bodyFields: ['summary', 'body'],
    where: { isPublished: true },
    url: (r) => `/news/${r.id}`,
    meta: (r) => ({ date: r.date }),
  },
  {
    type: 'event',
    label: 'Events',
    model: Event,
    fields: ['title', 'description', 'venue'],
    titleField: 'title',
    bodyFields: ['description', 'venue'],
    where: { isPublished: true },
    url: (r) => `/events/${r.id}`,
    meta: (r) => ({ startsAt: r.startsAt, venue: r.venue }),
  },
  {
    type: 'research',
    label: 'Research',
    model: Research,
    fields: ['title', 'description', 'faculty', 'authors', 'journal', 'inventors', 'collaboration_org', 'category'],
    titleField: 'title',
    bodyFields: ['description', 'authors', 'faculty'],
    url: (r) => `/research/${r.id}`,
    meta: (r) => ({ category: r.category, year: r.year, status: r.status }),
  },
  {
    type: 'facility',
    label: 'Facilities',
    model: Facility,
    fields: ['name', 'description', 'specifications', 'location', 'category', 'in_charge'],
    titleField: 'name',
    bodyFields: ['description', 'specifications'],
    where: { is_active: true },
    url: (r) => `/facilities/${r.id}`,
    meta: (r) => ({ category: r.category, location: r.location }),
  },
  {
    type: 'achievement',
    label: 'Achievements',
    model: Achievement,
    fields: ['title', 'description', 'students', 'category'],
    titleField: 'title',
    bodyFields: ['description', 'students'],
    where: { isPublished: true },
    url: (r) => `/achievements/${r.id}`,
    meta: (r) => ({ category: r.category }),
  },
  {
    type: 'opportunity',
    label: 'Opportunities',
    model: Opportunity,
    fields: ['title', 'subtitle', 'description', 'content_html'],
    titleField: 'title',
    bodyFields: ['subtitle', 'description', 'content_html'],
    where: { is_active: true },
    url: (r) => `/opportunities/${r.id}`,
    meta: (r) => ({ pageGroup: r.page_group }),
  },
  {
    type: 'newsletter',
    label: 'Newsletters',
    model: Newsletter,
    fields: ['title', 'description'],
    titleField: 'title',
    bodyFields: ['description'],
    url: () => '/newsletter',
    meta: (r) => ({ issueDate: r.issueDate }),
  },
  {
    type: 'directory',
    label: 'Directory',
    model: DirectoryEntry,
    // Deliberately excludes phone and email from the *searchable* fields so the
    // directory cannot be used to confirm whether a given address exists.
    // Those values are still returned, because this page is already public.
    fields: ['name', 'role', 'location'],
    titleField: 'name',
    bodyFields: ['role', 'location'],
    url: () => '/directory',
    meta: (r) => ({ role: r.role, location: r.location }),
  },
];

export const SEARCH_CATEGORIES = SOURCES.map((s) => ({
  type: s.type,
  label: s.label,
}));

/**
 * Search the published corpus.
 *
 * @param {object}   options
 * @param {string}   options.query       Raw user search term.
 * @param {string[]} [options.categories] Restrict to these `type` values.
 * @param {number}   [options.limit]     Page size (max 50).
 * @param {number}   [options.offset]    Rows to skip.
 * @param {number}   [options.perSource] Max rows fetched per table before ranking.
 * @param {object}   [options.constraints] Per-source access-control filters, as
 *   `{ [sourceType]: false | whereClause }`. `false` excludes the source from
 *   the query entirely; an object is ANDed into its WHERE clause. Built by
 *   assistantAccess.buildRetrievalConstraints — never by a request.
 *
 *   These are applied inside the SQL query, before ranking, snippeting or any
 *   downstream consumer sees a row. Filtering after the fact would mean
 *   unauthorised records exist in process memory and only a later `.filter()`
 *   stands between them and a response.
 */
export const searchContent = async ({
  query,
  categories = [],
  limit = 20,
  offset = 0,
  perSource = 25,
  constraints = {},
} = {}) => {
  const term = String(query || '').trim();

  if (term.length < 2) {
    return {
      query: term,
      total: 0,
      results: [],
      counts: {},
      message: 'Enter at least 2 characters to search',
    };
  }

  const pattern = `%${escapeLike(term)}%`;
  const requested = categories.length
    ? SOURCES.filter((s) => categories.includes(s.type))
    : SOURCES;

  // A source explicitly constrained to `false` is never queried at all, so its
  // rows cannot be loaded, ranked, logged or returned by accident.
  const active = requested.filter((s) => constraints[s.type] !== false);

  // Each table is queried independently and concurrently. A failure in one
  // source degrades that category rather than failing the whole search.
  const perSourceResults = await Promise.all(
    active.map(async (source) => {
      try {
        const accessWhere = constraints[source.type];

        /*
         * Combined with Op.and rather than object spread.
         *
         * Spreading would let a key in one clause silently overwrite the same
         * key in another — an access constraint that happened to mention
         * `isPublished` would replace the publication rule instead of
         * narrowing it. Op.and guarantees every clause is additive, so
         * publication status and access scope must both hold.
         *
         * Sequelize parameterises all of these values, so an id or an id list
         * cannot become SQL.
         */
        const clauses = [
          source.where || null,
          accessWhere && typeof accessWhere === 'object' ? accessWhere : null,
          {
            [Op.or]: source.fields.map((field) => ({
              [field]: { [Op.like]: pattern },
            })),
          },
        ].filter(Boolean);

        const rows = await source.model.findAll({
          where: { [Op.and]: clauses },
          limit: perSource,
        });

        return rows.map((row) => {
          const r = row.get({ plain: true });
          const title = r[source.titleField];
          const body = source.bodyFields.map((f) => r[f]).filter(Boolean).join(' ');

          return {
            type: source.type,
            category: source.label,
            id: r.id,
            title,
            snippet: makeSnippet(body || title, term),
            url: source.url(r),
            meta: source.meta ? source.meta(r) : {},
            score: scoreOf(term, title, body),
          };
        });
      } catch (error) {
        console.error(`Search failed for ${source.type}:`, error?.message);
        return [];
      }
    }),
  );

  const all = perSourceResults.flat().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(a.title || '').localeCompare(String(b.title || ''));
  });

  const counts = all.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] || 0) + 1;
    return acc;
  }, {});

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  return {
    query: term,
    total: all.length,
    counts,
    results: all.slice(safeOffset, safeOffset + safeLimit),
  };
};

/**
 * Lightweight title-only lookup for the navbar's type-ahead. Kept separate from
 * searchContent so a keystroke does not scan every body field.
 */
export const searchSuggestions = async (query, limit = 8) => {
  const term = String(query || '').trim();
  if (term.length < 2) return [];

  const pattern = `%${escapeLike(term)}%`;

  const groups = await Promise.all(
    SOURCES.map(async (source) => {
      try {
        const rows = await source.model.findAll({
          where: {
            ...(source.where || {}),
            [source.titleField]: { [Op.like]: pattern },
          },
          limit: 5,
        });
        return rows.map((row) => {
          const r = row.get({ plain: true });
          return {
            type: source.type,
            category: source.label,
            title: r[source.titleField],
            url: source.url(r),
            score: scoreOf(term, r[source.titleField], ''),
          };
        });
      } catch {
        return [];
      }
    }),
  );

  return groups
    .flat()
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};
