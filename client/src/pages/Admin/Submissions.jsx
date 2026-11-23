import { useCallback, useEffect, useState } from 'react';
import { Loader2, AlertCircle, Inbox, Check, XCircle } from 'lucide-react';
import { adminAPI } from '../../lib/api';

const STATUS_STYLES = {
  draft: 'bg-gray-100 text-gray-700',
  submitted: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-500',
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
 * Review queue for content submitted by faculty.
 *
 * Approving applies the payload and records a version, so an approved change is
 * as revertible as a direct edit. Rejecting requires a note — the submitter
 * sees it, and "rejected, no reason given" is not a useful answer.
 */
export default function Submissions() {
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [status, setStatus] = useState('submitted');

  const [acting, setActing] = useState(null);
  const [notes, setNotes] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (status) params.status = status;

      const res = await adminAPI.getSubmissions(params);
      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not load submissions.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const review = async (row, decision) => {
    const note = (notes[row.id] || '').trim();

    // Mirror the server rule client-side so the reviewer is not told off by a
    // round trip they could have been warned about.
    if (decision === 'reject' && !note) {
      setError('A note is required when rejecting. Tell the submitter why.');
      return;
    }

    setActing(row.id);
    setError(null);
    setNotice(null);
    try {
      const res = await adminAPI.reviewSubmission(row.id, { decision, note });
      setNotice(res.data?.data?.message || `Submission #${row.id} ${decision}d.`);
      setNotes((n) => ({ ...n, [row.id]: '' }));
      await load();
    } catch (err) {
      setError(err?.response?.data?.error || 'Could not record that decision.');
    } finally {
      setActing(null);
    }
  };

  const pending = meta?.byStatus?.submitted || 0;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submissions</h1>
          <p className="mt-1 text-sm text-gray-600">
            Changes submitted for review. Approving applies them and records a
            version, so anything approved here can still be rolled back from
            Change History.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-right">
          <div className="text-2xl font-semibold text-gray-900">{pending}</div>
          <div className="text-xs text-gray-500">awaiting review</div>
        </div>
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

      <div className="mb-4 flex flex-wrap gap-2">
        {['submitted', 'approved', 'rejected', 'withdrawn', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            onClick={() => setStatus(s)}
            aria-current={status === s ? 'true' : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${
              status === s
                ? 'bg-[#A6192E] text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            {s || 'All'}
            {meta?.byStatus?.[s] ? ` (${meta.byStatus[s]})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white p-16 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-16 text-center">
          <Inbox className="mx-auto mb-2 h-6 w-6 text-gray-400" aria-hidden="true" />
          <p className="font-medium text-gray-900">
            {status === 'submitted' ? 'Nothing awaiting review' : 'No submissions here'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Faculty submissions appear in this queue for approval.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const payload =
              typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
            const open = row.status === 'submitted';

            return (
              <li key={row.id} className="rounded-lg border border-gray-200 bg-white p-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-gray-700">
                        {row.resource}#{row.resource_id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[row.status] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Submitted by {row.submitter_email} · {formatWhen(row.submitted_at)}
                    </p>
                  </div>
                </div>

                <div className="mb-3 overflow-hidden rounded-lg border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-gray-600">
                    Proposed changes
                  </div>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {Object.entries(payload).map(([field, value]) => (
                        <tr key={field}>
                          <th
                            scope="row"
                            className="w-44 bg-gray-50/60 px-3 py-2 text-left font-mono text-xs font-medium text-gray-700"
                          >
                            {field}
                          </th>
                          <td className="whitespace-pre-wrap break-words px-3 py-2 text-gray-900">
                            {typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                          </td>
                        </tr>
                      ))}
                      {Object.keys(payload).length === 0 && (
                        <tr>
                          <td className="px-3 py-2 text-sm text-gray-500">
                            Empty payload — every field was stripped as protected.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {row.review_note && (
                  <p className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">Review note:</span> {row.review_note}
                    {row.reviewer_email && (
                      <span className="text-gray-500"> — {row.reviewer_email}</span>
                    )}
                  </p>
                )}

                {open && (
                  <div className="border-t border-gray-200 pt-4">
                    <label
                      htmlFor={`note-${row.id}`}
                      className="mb-1 block text-xs font-medium text-gray-600"
                    >
                      Note {' '}
                      <span className="font-normal text-gray-500">
                        (required to reject, optional to approve)
                      </span>
                    </label>
                    <textarea
                      id={`note-${row.id}`}
                      rows={2}
                      value={notes[row.id] || ''}
                      onChange={(e) =>
                        setNotes((n) => ({ ...n, [row.id]: e.target.value }))
                      }
                      placeholder="Explain the decision…"
                      className="mb-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => review(row, 'approve')}
                        disabled={acting === row.id}
                        className="inline-flex items-center gap-2 rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                      >
                        {acting === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        )}
                        Approve &amp; publish
                      </button>

                      <button
                        type="button"
                        onClick={() => review(row, 'reject')}
                        disabled={acting === row.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Reject
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
