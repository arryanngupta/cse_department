import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Link2,
  FileText,
  ImageOff,
  X,
} from 'lucide-react';
import { adminAPI } from '../../lib/api';

const PAGE_SIZE = 24;

/**
 * Media library.
 *
 * Shows every image and PDF the site references, and — the point of the page —
 * where each one is used, so an asset is never removed blind.
 */
export default function MediaLibrary() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [page, setPage] = useState(0);
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');

  const [syncing, setSyncing] = useState(false);
  const [usage, setUsage] = useState(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [broken, setBroken] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { limit: PAGE_SIZE, page: page + 1 };
      if (kind) params.kind = kind;
      if (q) params.q = q;

      const res = await adminAPI.getMedia(params);
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load the media library.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, kind, q]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminAPI
      .getBrokenMediaReferences()
      .then((res) => setBroken(res.data?.data || null))
      .catch(() => setBroken(null));
  }, []);

  const runSync = async () => {
    setSyncing(true);
    setNotice(null);
    setError(null);
    try {
      const res = await adminAPI.syncMedia();
      const d = res.data?.data || {};
      setNotice(
        `Sync complete — ${d.added ?? 0} added, ${d.existing ?? d.unchanged ?? 0} already catalogued.`,
      );
      setPage(0);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const showUsage = async (asset) => {
    setUsage({ asset, usedIn: null });
    setUsageLoading(true);
    try {
      const res = await adminAPI.getMediaUsage(asset.id);
      setUsage(res.data?.data || { asset, usedIn: [] });
    } catch {
      setUsage({ asset, usedIn: [], failed: true });
    } finally {
      setUsageLoading(false);
    }
  };

  const remove = async (asset) => {
    setNotice(null);
    setError(null);
    try {
      await adminAPI.deleteMedia(asset.id);
      setNotice(`Removed ${asset.filename || asset.url} from the catalogue.`);
      setUsage(null);
      await load();
    } catch (err) {
      // A 409 here is the feature working: the asset is still referenced.
      setError(err?.response?.data?.error || 'Could not remove that asset.');
    }
  };

  const total = meta?.total || 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;
  const brokenCount = broken?.summary?.relativePaths || 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Media Library</h1>
          <p className="mt-1 text-sm text-gray-600">
            Every image and PDF the site references. Removing an entry here takes
            it out of this catalogue only — it never deletes the file from
            Cloudinary.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {meta?.byKind && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right">
              <div className="text-2xl font-semibold text-gray-900">{total}</div>
              <div className="text-xs text-gray-500">
                {meta.byKind.image || 0} images · {meta.byKind.pdf || 0} PDFs
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-lg bg-[#A6192E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8B0000] disabled:opacity-60"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Sync
          </button>
        </div>
      </div>

      {brokenCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2.5">
            <ImageOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                {brokenCount} broken reference{brokenCount === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                These records point at files that are not hosted anywhere. Re-upload
                them through the relevant admin section to fix the links.
              </p>
              <ul className="mt-2 space-y-1">
                {(broken.relativePaths || []).map((b) => (
                  <li key={`${b.model}-${b.id}-${b.value}`} className="text-xs text-amber-900">
                    <span className="font-medium">{b.area}</span> #{b.id} →{' '}
                    <code className="rounded bg-amber-100 px-1 py-0.5">{b.value}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

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

      <div className="mb-4 flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label htmlFor="m-kind" className="mb-1 block text-xs font-medium text-gray-600">
            Type
          </label>
          <select
            id="m-kind"
            value={kind}
            onChange={(e) => {
              setPage(0);
              setKind(e.target.value);
            }}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            <option value="image">Images</option>
            <option value="pdf">PDFs</option>
          </select>
        </div>

        <div className="min-w-56 flex-1">
          <label htmlFor="m-q" className="mb-1 block text-xs font-medium text-gray-600">
            Search filename or title
          </label>
          <input
            id="m-q"
            value={q}
            onChange={(e) => {
              setPage(0);
              setQ(e.target.value);
            }}
            placeholder="e.g. slider, curriculum"
            className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-16 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading assets…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-16 text-center">
          <p className="font-medium text-gray-900">No assets match</p>
          <p className="mt-1 text-sm text-gray-600">
            Try clearing the filters, or run Sync to rebuild the catalogue from
            current content.
          </p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {rows.map((asset) => (
              <li
                key={asset.id}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white"
              >
                <div className="flex h-32 items-center justify-center bg-gray-50">
                  {asset.kind === 'image' ? (
                    <img
                      src={asset.url}
                      alt={asset.alt_text || asset.filename || 'Media asset'}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-10 w-10 text-gray-400" aria-hidden="true" />
                  )}
                </div>

                <div className="p-3">
                  <p
                    className="truncate text-xs font-medium text-gray-900"
                    title={asset.filename || asset.url}
                  >
                    {asset.title || asset.filename || 'Untitled'}
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-gray-500">
                    {asset.kind}
                  </p>

                  <button
                    type="button"
                    onClick={() => showUsage(asset)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[#A6192E] hover:underline"
                  >
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    Where is this used?
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {(page > 0 || hasMore) && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
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
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 enabled:hover:border-gray-400 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {usage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Asset usage"
        >
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {usage.asset?.title || usage.asset?.filename || 'Asset'}
              </h2>
              <button
                type="button"
                onClick={() => setUsage(null)}
                aria-label="Close"
                className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {usageLoading ? (
              <p className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking references…
              </p>
            ) : (
              <>
                {usage.usedIn?.length ? (
                  <>
                    <p className="mb-2 text-sm text-gray-700">
                      Referenced by {usage.usedIn.length} record
                      {usage.usedIn.length === 1 ? '' : 's'}:
                    </p>
                    <ul className="mb-4 space-y-1.5">
                      {usage.usedIn.map((u) => (
                        <li
                          key={`${u.model}-${u.id}`}
                          className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800"
                        >
                          {u.area} <span className="text-gray-500">#{u.id}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-600">
                      This asset cannot be removed while those references exist.
                      Replace it in each record first.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mb-4 text-sm text-gray-700">
                      Nothing references this asset.
                    </p>
                    <button
                      type="button"
                      onClick={() => remove(usage.asset)}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove from catalogue
                    </button>
                  </>
                )}

                <p className="mt-4 break-all text-xs text-gray-400">{usage.asset?.url}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
