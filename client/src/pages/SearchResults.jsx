import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, AlertCircle } from 'lucide-react';
import { publicAPI } from '../lib/api';
import SEO from '../components/SEO';

const PAGE_SIZE = 20;

/** Wrap matches in the result text so the user can see why it matched. */
function Highlight({ text, term }) {
  if (!text) return null;
  if (!term) return <>{text}</>;

  // Escape the term before building a regex from it.
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = String(text).split(new RegExp(`(${safe})`, 'gi'));

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-gray-900">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ResultSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 h-4 w-1/3 rounded bg-gray-200" />
      <div className="mb-2 h-3 w-full rounded bg-gray-100" />
      <div className="h-3 w-2/3 rounded bg-gray-100" />
    </div>
  );
}

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') || '';

  // Kept as the raw serialized string so it can be a statically checkable
  // effect dependency; the array is derived from it.
  const categoryParam = params.get('categories') || '';
  const activeCategories = categoryParam.split(',').filter(Boolean);

  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    publicAPI
      .searchCategories()
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => setCategories([]));
  }, []);

  // Reset to the first page whenever the query or filters change.
  useEffect(() => {
    setPage(0);
  }, [query, categoryParam]);

  const run = useCallback(async () => {
    if (!query.trim()) {
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await publicAPI.search({
        q: query,
        categories: activeCategories.join(','),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setData(res.data?.data || null);
    } catch {
      setError('Search is unavailable right now. Please try again shortly.');
      setData(null);
    } finally {
      setLoading(false);
    }
    // activeCategories is derived from categoryParam, so depending on the
    // serialized string keeps this callback stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, categoryParam, page]);

  useEffect(() => {
    run();
  }, [run]);

  const toggleCategory = (type) => {
    const next = activeCategories.includes(type)
      ? activeCategories.filter((c) => c !== type)
      : [...activeCategories, type];

    const nextParams = { q: query };
    if (next.length) nextParams.categories = next.join(',');
    setParams(nextParams);
  };

  const total = data?.total || 0;
  const shown = data?.results?.length || 0;
  const hasMore = page * PAGE_SIZE + shown < total;

  return (
    <>
      <SEO
        title={query ? `Search: ${query}` : 'Search'}
        description="Search faculty, programs, research, news, events and facilities across the LNMIIT CSE department website."
      />

      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">Search</h1>

        {query ? (
          <p className="mb-6 text-sm text-gray-600">
            {loading
              ? 'Searching…'
              : `${total} result${total === 1 ? '' : 's'} for “${query}”`}
          </p>
        ) : (
          <p className="mb-6 text-sm text-gray-600">
            Enter a search term to look across faculty, programs, research, news,
            events, facilities and more.
          </p>
        )}

        {/* Category filters */}
        {query && categories.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {categories.map((c) => {
              const active = activeCategories.includes(c.type);
              const count = data?.counts?.[c.type];
              return (
                <button
                  key={c.type}
                  type="button"
                  onClick={() => toggleCategory(c.type)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? 'border-[#8B0000] bg-[#8B0000] text-white'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  {c.label}
                  {count ? (
                    <span className={active ? 'ml-1.5 opacity-80' : 'ml-1.5 text-gray-500'}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <ResultSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && query && data && total === 0 && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-gray-400" />
            <p className="mb-1 font-medium text-gray-900">No results found</p>
            <p className="text-sm text-gray-600">
              {data.message ||
                'Try a different term, or remove some category filters.'}
            </p>
          </div>
        )}

        {!loading && data?.results?.length > 0 && (
          <>
            <ul className="space-y-3">
              {data.results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <Link
                    to={r.url}
                    className="block rounded-lg border border-gray-200 bg-white p-5 transition hover:border-[#8B0000]/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#8B0000]/30"
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-3">
                      <h2 className="font-semibold text-gray-900">
                        <Highlight text={r.title} term={query} />
                      </h2>
                      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                        {r.category}
                      </span>
                    </div>
                    {r.snippet && (
                      <p className="text-sm leading-relaxed text-gray-600">
                        <Highlight text={r.snippet} term={query} />
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            {(page > 0 || hasMore) && (
              <div className="mt-6 flex items-center justify-between">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition enabled:hover:border-gray-400 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-500">
                  {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + shown} of {total}
                </span>
                <button
                  type="button"
                  disabled={!hasMore}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition enabled:hover:border-gray-400 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
