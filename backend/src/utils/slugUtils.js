// src/utils/slugUtils.js

/** Honorifics stripped from the start of a name before slugging. */
const TITLES = [
  'dr', 'prof', 'professor', 'mr', 'mrs', 'ms', 'miss',
  'shri', 'smt', 'sri', 'er', 'eng', 'engr',
];

// Matches a leading title with or without its full stop: "Dr. ", "Prof.", "Mr ".
const TITLE_PATTERN = new RegExp(`^\\s*(${TITLES.join('|')})(\\.\\s*|\\s+)`, 'i');

/**
 * Generate a URL-friendly slug from a name.
 *
 *   "Sunil Kumar"      -> "sunil-kumar"
 *   "Dr. Rajbir Kaur"  -> "rajbir-kaur"
 *   "José Álvarez"     -> "jose-alvarez"
 *
 * Four things the previous version got wrong, all reproducible:
 *
 *   1. Accented characters were deleted rather than transliterated, so
 *      "José Álvarez" became "jos-lvarez". Normalising to NFD and dropping the
 *      combining marks turns it into "jose-alvarez" instead.
 *
 *   2. A name consisting only of punctuation or non-Latin script produced an
 *      **empty string** — "!!!", "Dr." and "日本語" all slugged to "". An empty
 *      slug makes /people/<slug> resolve to the People list rather than a
 *      profile, and the second such record collides on the unique index. There
 *      is now a fallback.
 *
 *   3. Leading and trailing hyphens survived: "-- Weird --" became "-weird-".
 *
 *   4. A title was only stripped when written with a full stop, so
 *      "Dr. Amit Sharma" became "amit-sharma" while "Dr Amit Sharma" became
 *      "dr-amit-sharma" — two different slugs for the same person depending on
 *      typing. Only dr and prof were handled at all.
 *
 * @param {string} name
 * @param {string} [fallback] Used when the name yields nothing sluggable.
 *   Callers that have a stable id should pass something derived from it.
 */
export const generateSlug = (name, fallback = '') => {
  if (!name) return fallback;

  const slug = String(name)
    // Decompose accented characters into base letter + combining mark, then
    // drop the marks, so an accented letter becomes its base letter.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Strip a leading honorific, however it was written.
    .replace(TITLE_PATTERN, '')
    // Separators become hyphens rather than vanishing, so "A/B" is "a-b" and
    // not "ab".
    .replace(/[\s/\\_.,+&]+/g, '-')
    // Anything still not URL-safe goes.
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    // Trim hyphens from both ends.
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
};

/**
 * Auto-generate slug on model creation/update.
 * Usage in controller: person.slug = generateSlug(person.name);
 */
export const ensureSlug = (person) => {
  if (!person.slug && person.name) {
    person.slug = generateSlug(person.name);
  }
  return person;
};
