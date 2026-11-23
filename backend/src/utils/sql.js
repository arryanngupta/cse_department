// backend/src/utils/sql.js

/**
 * Escape the wildcard characters MySQL's LIKE treats specially.
 *
 * Sequelize parameterizes the *value*, which prevents SQL injection, but it
 * does not neutralize `%` and `_` inside that value — those stay wildcards. So
 * a filter of `?q=%` matches every row in the table, and `?q=_` matches any
 * single character. Callers that interpolate user input into a LIKE pattern
 * must run it through this first.
 *
 * Backslash is escaped too, otherwise a trailing `\` would escape the closing
 * `%` the caller appends.
 */
export const escapeLike = (value) =>
  String(value ?? '').replace(/[\\%_]/g, (char) => `\\${char}`);
