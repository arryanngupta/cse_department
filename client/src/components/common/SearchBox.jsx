import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Loader2 } from 'lucide-react';
import { publicAPI } from '../../lib/api';

/**
 * Navbar search with type-ahead.
 *
 * Requests are debounced and the in-flight request is aborted when the query
 * changes, so fast typing cannot leave a stale response overwriting a newer
 * one.
 */
export default function SearchBox({ className = '', onNavigate }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const navigate = useNavigate();
  const containerRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await publicAPI.searchSuggestions(term, {
          signal: controller.signal,
        });
        setSuggestions(res.data?.data || []);
        setActiveIndex(-1);
      } catch {
        // Aborted or failed: leave the previous suggestions in place rather
        // than flashing an empty list.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Close the dropdown when focus or the pointer leaves the component.
  useEffect(() => {
    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const go = (url) => {
    setOpen(false);
    setQuery('');
    onNavigate?.();
    navigate(url);
  };

  const submit = () => {
    const term = query.trim();
    if (!term) return;
    setOpen(false);
    onNavigate?.();
    navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        go(suggestions[activeIndex].url);
      } else {
        submit();
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search the department…"
          aria-label="Search the department website"
          aria-expanded={open && suggestions.length > 0}
          aria-controls="search-suggestions"
          role="combobox"
          aria-autocomplete="list"
          className="w-full rounded-full border border-gray-300 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 outline-none transition focus:border-[#8B0000] focus:ring-2 focus:ring-[#8B0000]/20"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {open && query.trim().length >= 2 && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl"
        >
          {suggestions.length === 0 && !loading ? (
            <p className="px-4 py-3 text-sm text-gray-500">
              No matches. Press Enter to search everything.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={`${s.type}-${s.url}-${i}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => go(s.url)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition ${
                      i === activeIndex ? 'bg-[#8B0000]/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate text-sm text-gray-900">{s.title}</span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {s.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={submit}
            className="block w-full border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-left text-sm font-medium text-[#8B0000] transition hover:bg-gray-100"
          >
            See all results for “{query.trim()}”
          </button>
        </div>
      )}
    </div>
  );
}
