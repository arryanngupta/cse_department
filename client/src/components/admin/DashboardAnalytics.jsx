import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminAPI } from '../../lib/api';
import TrendChart from './TrendChart.jsx';

/**
 * Analytics block for the admin dashboard.
 *
 * Every number comes from the aggregate endpoints, which count real rows.
 * Fails quietly to a message rather than rendering a chart of zeros that
 * looks like real data.
 */
export default function DashboardAnalytics() {
  const [trends, setTrends] = useState(null);
  const [health, setHealth] = useState(null);
  const [research, setResearch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    Promise.all([
      adminAPI.getAnalyticsTrends({ months: 12 }),
      adminAPI.getAnalyticsHealth(),
      adminAPI.getAnalyticsOverview(),
    ])
      .then(([t, h, o]) => {
        if (!alive) return;
        setTrends(t.data?.data || null);
        setHealth(h.data?.data || null);
        setResearch(o.data?.data?.research || null);
      })
      .catch(() => {
        if (alive) setError('Analytics could not be loaded.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-8 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {error}
      </div>
    );
  }

  const researchEntries = Object.entries(research?.byCategory || {});
  const researchMax = Math.max(1, ...researchEntries.map(([, n]) => n));

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          Content added over the last 12 months
        </h2>
        <p className="mb-4 text-sm text-gray-600">
          Counted from record creation dates.
        </p>
        <TrendChart months={trends?.months || []} series={trends?.series || {}} />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Research mix — a horizontal bar chart is easier to label than a pie,
            and the category names are long. */}
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Research by type</h2>

          {researchEntries.length === 0 ? (
            <p className="text-sm text-gray-500">No research records yet.</p>
          ) : (
            <ul className="space-y-3">
              {researchEntries.map(([category, count]) => (
                <li key={category}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-gray-700">{category}</span>
                    <span className="font-medium text-gray-900">{count}</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-gray-100"
                    role="img"
                    aria-label={`${category}: ${count} of ${research.total}`}
                  >
                    <div
                      className="h-full rounded-full bg-[#8B0000]"
                      style={{ width: `${(count / researchMax) * 100}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Actionable content-quality checks. */}
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-lg font-semibold text-gray-900">Content health</h2>
          <p className="mb-4 text-sm text-gray-600">
            {health?.needsAttention
              ? `${health.needsAttention} item${health.needsAttention === 1 ? '' : 's'} worth a look.`
              : 'Nothing needs attention.'}
          </p>

          <ul className="space-y-2.5">
            {(health?.checks || []).map((check) => (
              <li
                key={check.label}
                className="flex items-start gap-2.5 rounded-lg border border-gray-100 p-2.5"
              >
                {check.count > 0 ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                )}
                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {check.count}
                    </span>
                    <span className="text-sm text-gray-700">{check.label}</span>
                  </div>
                  {check.count > 0 && (
                    <p className="mt-0.5 text-xs text-gray-500">{check.hint}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
