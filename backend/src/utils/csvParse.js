// backend/src/utils/csvParse.js
//
// Minimal RFC 4180 CSV parser.
//
// Hand-written rather than pulled from npm because the requirement is narrow
// (parse an admin-supplied file of a few hundred rows) and a naive
// `split(',')` is wrong the moment a field contains a comma, a quote, or a
// newline — which addresses, titles and notes routinely do.

/**
 * Parse CSV text into rows of cells.
 *
 * Handles quoted fields, escaped quotes (`""`), embedded commas and newlines,
 * and both CRLF and LF line endings. Strips a UTF-8 BOM, which Excel writes
 * and which would otherwise corrupt the first header name.
 *
 * @param {string} text
 * @returns {string[][]}
 */
export const parseCsv = (text) => {
  const input = String(text ?? '').replace(/^﻿/, '');

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          // Escaped quote inside a quoted field.
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (char === '\r' || char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      // Consume CRLF as one terminator.
      i += char === '\r' && input[i + 1] === '\n' ? 2 : 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Trailing field/row, unless the file ended on a line terminator.
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  // Drop entirely blank lines, which trailing newlines and Excel both produce.
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
};

/**
 * Parse CSV into objects keyed by header.
 *
 * Headers are normalised (trimmed, lowercased, spaces to underscores) so
 * "Full Name", "full name" and "full_name" all map to `full_name`.
 *
 * @returns {{headers: string[], rows: object[], errors: string[]}}
 */
export const parseCsvToObjects = (text) => {
  const table = parseCsv(text);
  const errors = [];

  if (!table.length) {
    return { headers: [], rows: [], errors: ['The file is empty'] };
  }

  const headers = table[0].map((h) =>
    String(h).trim().toLowerCase().replace(/\s+/g, '_'),
  );

  const duplicates = headers.filter((h, idx) => headers.indexOf(h) !== idx);
  if (duplicates.length) {
    errors.push(`Duplicate column(s): ${[...new Set(duplicates)].join(', ')}`);
  }

  const rows = table.slice(1).map((cells, index) => {
    const row = { __line: index + 2 }; // +2: 1-indexed, and row 1 is the header.

    headers.forEach((header, col) => {
      row[header] = cells[col] !== undefined ? String(cells[col]).trim() : '';
    });

    if (cells.length !== headers.length) {
      row.__warning = `Expected ${headers.length} columns, found ${cells.length}`;
    }

    return row;
  });

  return { headers, rows, errors };
};
