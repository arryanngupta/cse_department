import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, History, RotateCcw, X } from 'lucide-react';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 40;

const TYPE_STYLES = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  restore: 'bg-purple-100 text-purple-800',
};

const formatWhen = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/**
 * Change history across every versioned entity, with a field-level diff and
 * restore.
 *
 * The diff deliberately shows only fields that actually differ — the API
 * returns every field with a `changed` flag, and rendering all of them buries
 * the two that matter.
 */
export default function VersionHistory() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(0);
  const [resourceFilter, setResourceFilter] = useState('');

  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, page: page + 1 };
      if (resourceFilter) params.resource = resourceFilter;

      const res = await adminAPI.getRecentVersions(params);
      setRows(res.data?.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load change history.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, resourceFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDiff = async (row) => {
    setDetail({ row, data: null });
    setDetailLoading(true);
    try {
      const res = await adminAPI.getVersion(row.resource, row.resource_id, row.version);
      setDetail({ row, data: res.data?.data || null });
    } catch (err) {
      setDetail({
        row,
        data: null,
        failed: err?.response?.data?.error || 'Could not load that version.',
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const restore = async () => {
    if (!detail?.row) return;
    const { resource, resource_id: id, version } = detail.row;

    setRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAPI.restoreVersion(resource, id, version);
      setNotice(
        res.data?.data?.message || `Restored ${resource} #${id} to version ${version}.`,
      );
      setDetail(null);
      await load();
    } catch (err) {
      // 409 here means the record was deleted — restoring would reuse its id.
      setError(err?.response?.data?.error || 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  const changedFields = (detail?.data?.diff || []).filter((f) => f.changed);
  const resources = [...new Set(rows.map((r) => r.resource))].sort();

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Change History</h1>
        <p className="mt-1 text-sm text-gray-600">
          What every record used to say, and the ability to put it back. A restore
          is itself recorded, so it can be undone too.
        </p>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <label htmlFor="v-resource" className="mb-1 block text-xs font-medium text-gray-600">
          Filter by type
        </label>
        <select
          id="v-resource"
          value={resourceFilter}
          onChange={(e) => {
            setPage(0);
            setResourceFilter(e.target.value);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">All types</option>
          {resources.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Change</th>
                <th className="px-4 py-2.5 font-medium">Record</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Fields</th>
                <th className="px-4 py-2.5 font-medium">By</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading…
                  </td>
                </tr>
              )}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <History className="mx-auto mb-2 h-6 w-6 text-gray-400" aria-hidden="true" />
                    <p className="font-medium text-gray-900">No changes recorded yet</p>
                    <p className="text-sm text-gray-600">
                      Edit any news item, event or profile and it will appear here.
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
                          TYPE_STYLES[row.change_type] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.change_type}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                      {row.resource}#{row.resource_id}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">v{row.version}</td>
                    <td className="max-w-56 truncate px-4 py-2.5 text-xs text-gray-500">
                      {row.changed_fields || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">{row.actor_email || '—'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDiff(row)}
                        className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {(page > 0 || rows.length === PAGE_SIZE) && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page + 1}</span>
            <button
              type="button"
              disabled={rows.length < PAGE_SIZE}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Version detail"
        >
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {detail.row.resource}#{detail.row.resource_id} — version{' '}
                  {detail.row.version}
                </h2>
                <p className="mt-0.5 text-sm text-gray-600">
                  {detail.row.change_type} by {detail.row.actor_email} ·{' '}
                  {formatWhen(detail.row.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {detailLoading ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading diff…
              </p>
            ) : detail.failed ? (
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                {detail.failed}
              </p>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-700">
                  {changedFields.length === 0
                    ? 'This snapshot is identical to what is live now.'
                    : changedFields.length === 1
                      ? '1 field differs from what is live now:'
                      : `${changedFields.length} fields differ from what is live now:`}
                </p>

                {changedFields.length > 0 && (
                  <ul className="mb-5 space-y-3">
                    {changedFields.map((f) => (
                      <li key={f.field} className="rounded-lg border border-gray-200">
                        <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 font-mono text-xs font-medium text-gray-700">
                          {f.field}
                        </div>
                        <div className="grid grid-cols-1 divide-y divide-gray-200 md:grid-cols-2 md:divide-x md:divide-y-0">
                          <div className="p-3">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-green-700">
                              This version
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm text-gray-900">
                              {f.from ?? <span className="text-gray-400">empty</span>}
                            </div>
                          </div>
                          <div className="p-3">
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                              Live now
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm text-gray-900">
                              {f.to ?? <span className="text-gray-400">empty</span>}
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={restore}
                    disabled={restoring || changedFields.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#A6192E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8B0000] disabled:opacity-50"
                  >
                    {restoring ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    )}
                    Restore this version
                  </button>
                  <p className="text-xs text-gray-600">
                    {changedFields.length === 0
                      ? 'Nothing to restore — this is already the live state.'
                      : 'The current state is saved first, so this can be undone.'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
