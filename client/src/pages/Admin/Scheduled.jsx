import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, CalendarClock, Play, Trash2 } from 'lucide-react';
import { adminAPI } from '../../lib/api';

const formatWhen = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

/**
 * Scheduled publication.
 *
 * Schedules live in the database and are applied by a polling worker, so they
 * survive restarts — "Run now" exists only to avoid waiting out the interval
 * when testing.
 */
export default function Scheduled() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [running, setRunning] = useState(false);

  // The "add a schedule" form.
  const [resource, setResource] = useState('news');
  const [recordId, setRecordId] = useState('');
  const [publishAt, setPublishAt] = useState('');
  const [unpublishAt, setUnpublishAt] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminAPI.getSchedule();
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load schedules.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAPI.setSchedule(resource, recordId, {
        // Send ISO so the server is not guessing at the browser's timezone.
        publish_at: publishAt ? new Date(publishAt).toISOString() : null,
        unpublish_at: unpublishAt ? new Date(unpublishAt).toISOString() : null,
      });

      // Say plainly when the save has taken the record off the site — an
      // editor scheduling a live item should not discover that by accident.
      const nowHidden = res.data?.data?.live === false;
      setNotice(
        nowHidden
          ? `Schedule saved. ${resource} #${recordId} is now hidden from the public site until its publish time.`
          : `Schedule saved for ${resource} #${recordId}.`,
      );
      setRecordId('');
      setPublishAt('');
      setUnpublishAt('');
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not save that schedule.');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (row) => {
    setError(null);
    setNotice(null);
    const wasHidden = !(row.isPublished || row.is_active);
    try {
      await adminAPI.setSchedule(row.resource, row.id, {
        publish_at: null,
        unpublish_at: null,
      });
      setNotice(
        wasHidden
          ? `Cleared the schedule on ${row.resource} #${row.id}. It is still hidden — publish it from the ${row.resource} section when you are ready.`
          : `Cleared the schedule on ${row.resource} #${row.id}.`,
      );
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not clear that schedule.');
    }
  };

  /** Clears the schedule and makes the record live in one step. */
  const publishNow = async (row) => {
    setError(null);
    setNotice(null);
    try {
      await adminAPI.setSchedule(row.resource, row.id, { publish_now: true });
      setNotice(`${row.resource} #${row.id} is now live.`);
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not publish that record.');
    }
  };

  const runNow = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAPI.runScheduler();
      const d = res.data?.data || {};
      setNotice(
        `Applied ${d.published ?? 0} publication${d.published === 1 ? '' : 's'} and ${
          d.unpublished ?? 0
        } removal${d.unpublished === 1 ? '' : 's'}.`,
      );
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not run the scheduler.');
    } finally {
      setRunning(false);
    }
  };

  const schedulable = meta?.schedulable || ['news', 'events', 'achievements'];

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Publishing</h1>
          <p className="mt-1 text-sm text-gray-600">
            Schedules are stored in the database, not in memory. If the server is
            down when something comes due, it publishes as soon as the server is
            back — nothing is skipped.
          </p>
        </div>

        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:border-gray-400 disabled:opacity-60"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          Run now
        </button>
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

      <form
        onSubmit={save}
        className="mb-6 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div>
          <label htmlFor="s-resource" className="mb-1 block text-xs font-medium text-gray-600">
            Type
          </label>
          <select
            id="s-resource"
            value={resource}
            onChange={(e) => setResource(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          >
            {schedulable.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="s-id" className="mb-1 block text-xs font-medium text-gray-600">
            Record ID
          </label>
          <input
            id="s-id"
            type="number"
            min="1"
            required
            value={recordId}
            onChange={(e) => setRecordId(e.target.value)}
            placeholder="e.g. 4"
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="s-pub" className="mb-1 block text-xs font-medium text-gray-600">
            Publish at
          </label>
          <input
            id="s-pub"
            type="datetime-local"
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="s-unpub" className="mb-1 block text-xs font-medium text-gray-600">
            Unpublish at
            <span className="ml-1 font-normal text-gray-500">(optional)</span>
          </label>
          <input
            id="s-unpub"
            type="datetime-local"
            value={unpublishAt}
            onChange={(e) => setUnpublishAt(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving || !recordId || (!publishAt && !unpublishAt)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#A6192E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8B0000] disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save schedule
        </button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-16 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-16 text-center">
          <CalendarClock className="mx-auto mb-2 h-6 w-6 text-gray-400" aria-hidden="true" />
          <p className="font-medium text-gray-900">Nothing is scheduled</p>
          <p className="mt-1 text-sm text-gray-600">
            Use the form above to schedule a news item, event, achievement,
            facility or opportunity.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Record</th>
                <th className="px-4 py-2.5 font-medium">Title</th>
                <th className="px-4 py-2.5 font-medium">Goes live</th>
                <th className="px-4 py-2.5 font-medium">Comes down</th>
                <th className="px-4 py-2.5 font-medium">Live now?</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={`${row.resource}-${row.id}`} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-gray-700">
                    {row.resource}#{row.id}
                  </td>
                  <td className="max-w-72 truncate px-4 py-2.5 text-gray-900">
                    {row.title || row.name || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                    {formatWhen(row.publish_at) || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                    {formatWhen(row.unpublish_at) || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.isPublished || row.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {row.isPublished || row.is_active ? 'live' : 'hidden'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex justify-end gap-2">
                      {!(row.isPublished || row.is_active) && (
                        <button
                          type="button"
                          onClick={() => publishNow(row)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-800"
                        >
                          <Play className="h-3 w-3" aria-hidden="true" />
                          Publish now
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => clear(row)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-gray-400"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        {row.isPublished || row.is_active ? 'Clear' : 'Clear, keep hidden'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-xs text-gray-500">
        Hidden records are invisible on the public site, in search, and to the AI
        assistant — scheduling a future publish time hides the record until then.
      </p>
    </div>
  );
}
