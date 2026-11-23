// backend/src/utils/pagination.js
//
// Shared, defensive pagination parsing.
//
// Controllers previously did `const { page = 1, limit = 20 } = req.query` and
// passed `parseInt(limit, 10)` straight to Sequelize. Two bugs followed:
//
//   ?limit=abc   → parseInt gives NaN → Sequelize throws "Undeclared variable:
//                  NaN" → HTTP 500 on four public endpoints.
//   ?limit=99999 → accepted, letting any caller pull an entire table in one
//                  request.
//
// Defaults are applied instead of erroring, because a bad query string on a
// public listing should degrade to the first page, not fail the request.

/** Hard ceiling. No public listing needs more than this in one response. */
export const MAX_LIMIT = 100;

/**
 * Parse `page`/`limit` from a query object into values that are always safe to
 * hand to Sequelize.
 *
 * @param {object} query            Usually `req.query`.
 * @param {object} [options]
 * @param {number} [options.defaultLimit=20]
 * @param {number} [options.maxLimit=MAX_LIMIT]
 * @returns {{page: number, limit: number, offset: number}} All integers ≥ 0.
 */
export const parsePagination = (query = {}, options = {}) => {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? MAX_LIMIT;

  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  // Number.isFinite rejects NaN and Infinity in one check.
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  let limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit, offset: (page - 1) * limit };
};

/**
 * Build the `meta` block returned alongside paginated results.
 *
 * `totalPages` is computed from the clamped limit, so it stays consistent with
 * what was actually returned.
 */
export const buildMeta = (count, { page, limit }) => ({
  total: count,
  page,
  limit,
  totalPages: limit > 0 ? Math.ceil(count / limit) : 0,
});
