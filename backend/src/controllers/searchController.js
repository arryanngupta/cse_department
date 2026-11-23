// backend/src/controllers/searchController.js

import {
  searchContent,
  searchSuggestions,
  SEARCH_CATEGORIES,
} from '../services/searchService.js';

const MAX_QUERY_LENGTH = 100;

const readCategories = (raw) =>
  String(raw || '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
    .filter((c) => SEARCH_CATEGORIES.some((s) => s.type === c));

/** GET /api/search?q=&categories=&limit=&offset= */
export const search = async (req, res, next) => {
  try {
    const query = String(req.query.q || '').slice(0, MAX_QUERY_LENGTH);

    const result = await searchContent({
      query,
      categories: readCategories(req.query.categories),
      limit: req.query.limit,
      offset: req.query.offset,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
};

/** GET /api/search/suggestions?q= */
export const suggestions = async (req, res, next) => {
  try {
    const query = String(req.query.q || '').slice(0, MAX_QUERY_LENGTH);
    const data = await searchSuggestions(query);
    res.json({ data });
  } catch (error) {
    next(error);
  }
};

/** GET /api/search/categories — drives the filter chips in the UI. */
export const categories = async (req, res) => {
  res.json({ data: SEARCH_CATEGORIES });
};
