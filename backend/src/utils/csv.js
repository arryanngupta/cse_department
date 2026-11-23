// backend/src/utils/csv.js

/**
 * Serialize rows to CSV.
 *
 * Two escaping concerns, both handled here:
 *
 * 1. CSV quoting — a value containing a comma, quote or newline must be
 *    wrapped in quotes with inner quotes doubled, or the column layout breaks.
 *
 * 2. Formula injection — Excel, LibreOffice and Google Sheets execute a cell
 *    beginning with `=`, `+`, `-`, `@`, tab or carriage return. A registrant
 *    who enters `=HYPERLINK("http://evil","click")` as their name would have
 *    that run on the organiser's machine when they open the export. Such
 *    values are prefixed with an apostrophe, which spreadsheets treat as
 *    "literal text" and do not display.
 */

const RISKY_LEADING = /^[=+\-@\t\r]/;

const escapeCell = (value) => {
  if (value === null || value === undefined) return '';

  let text = String(value);

  if (RISKY_LEADING.test(text)) {
    text = `'${text}`;
  }

  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }

  return text;
};

/**
 * @param {Array<{key: string, label: string}>} columns
 * @param {Array<object>} rows
 * @returns {string} CSV text with a UTF-8 BOM.
 */
export const toCsv = (columns, rows) => {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(row[c.key])).join(','),
  );

  // The BOM makes Excel open UTF-8 correctly; without it, accented names and
  // Devanagari text are mangled.
  return `﻿${[header, ...body].join('\r\n')}\r\n`;
};

/** Filename-safe slug for Content-Disposition. */
export const safeFilename = (value, fallback = 'export') => {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug || fallback;
};
