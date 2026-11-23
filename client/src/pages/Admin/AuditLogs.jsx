import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 50;

const ACTION_STYLES = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  login: 'bg-gray-100 text-gray-700',
};

const formatWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Read-only audit trail viewer.
 *
 * There are intentionally no edit or delete controls: a log an admin can
 * rewrite proves nothing.
 */
export default function AuditLogs() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState({
    action: '',
    resource: '',
    actor: '',
    q: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    adminAPI
      .getAuditLogSummary()
      .then((res) => setSummary(res.data?.data || null))
      .catch(() => setSummary(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, offset: page * PAGE_SIZE };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }

      const res = await adminAPI.getAuditLogs(params);
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      setError(
        err?.response?.data?.error || 'Could not load the audit log. Please try again.',
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (key) => (e) => {
    setPage(0);
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  };

  const total = meta?.total || 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="mt-1 text-sm text-gray-600">
            Every content change and sign-in. Read-only — entries cannot be
            edited or removed from here.
          </p>
        </div>

        {summary && (
          <div className="shrink-0 rounded-lg border border-gray-200 bg-white px-4 py-2 text-right">
            <div className="text-2xl font-semibold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500">entries recorded</div>
          </div>
        )}
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <label htmlFor="f-action" className="mb-1 block text-xs font-medium text-gray-600">
            Action
          </label>
          <select
            id="f-action"
            value={filters.action}
            onChange={updateFilter('action')}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {Object.keys(summary?.byAction || { create: 0, update: 0, delete: 0, login: 0 }).map(
              (a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label htmlFor="f-resource" className="mb-1 block text-xs font-medium text-gray-600">
            Resource
          </label>
          <input
            id="f-resource"
            value={filters.resource}
            onChange={updateFilter('resource')}
            placeholder="news, people…"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="f-actor" className="mb-1 block text-xs font-medium text-gray-600">
            Actor email
          </label>
          <input
            id="f-actor"
            value={filters.actor}
            onChange={updateFilter('actor')}
            placeholder="admin@…"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-gray-600">
            From
          </label>
          <input
            id="f-from"
            type="date"
            value={filters.from}
            onChange={updateFilter('from')}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-gray-600">
            To
          </label>
          <input
            id="f-to"
            type="date"
            value={filters.to}
            onChange={updateFilter('to')}
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div>
          <label htmlFor="f-q" className="mb-1 block text-xs font-medium text-gray-600">
            Search
          </label>
          <input
            id="f-q"
            value={filters.q}
            onChange={updateFilter('q')}
            placeholder="summary or path"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Resource</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Summary</th>
                <th className="px-4 py-2.5 font-medium">Fields</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center">
                    <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-gray-400" />
                    <p className="font-medium text-gray-900">No entries match</p>
                    <p className="text-sm text-gray-600">
                      Try clearing the filters, or make a change to generate one.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-gray-600">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          ACTION_STYLES[row.action] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {row.resource}
                      {row.resource_id ? `#${row.resource_id}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {row.actor_email || <span className="text-gray-400">anonymous</span>}
                      {row.actor_role && (
                        <span className="ml-1 text-xs text-gray-500">({row.actor_role})</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-900">{row.summary || '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500">
                      {row.changed_fields || '—'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {(page > 0 || hasMore) && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length} of {total}
            </span>
            <button
              type="button"
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
