// src/utils/slugUtils.js

/**
 * Generate a URL-friendly slug from a name
 * Example: "Sunil Kumar" -> "sunil-kumar"
 */
export const generateSlug = (name) => {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/\b(dr|prof)\.\s*/g, '') // remove titles like Dr. Prof.
    .replace(/[^\w\s-]/g, '')         // remove special chars
    .trim()
    .replace(/\s+/g, '-')             
    .replace(/-+/g, '-');
};

/**
 * Auto-generate slug on model creation/update
 * Usage in controller: person.slug = generateSlug(person.name);
 */
export const ensureSlug = (person) => {
  if (!person.slug && person.name) {
    person.slug = generateSlug(person.name);
  }
  return person;
};