/**
 * Multi-series line chart, hand-rolled as inline SVG.
 *
 * No charting library: the bundle is already over the 500 KB warning
 * threshold, and this needs one chart type. Inline SVG is a few hundred bytes
 * and renders identically everywhere.
 *
 * Accessibility: the chart is `role="img"` with a text summary, and the same
 * numbers are exposed in a visually-hidden table so a screen reader gets the
 * data rather than an unlabelled graphic.
 */

const PALETTE = {
  news: { stroke: '#8B0000', label: 'News' },
  events: { stroke: '#1d4ed8', label: 'Events' },
  achievements: { stroke: '#b45309', label: 'Achievements' },
  research: { stroke: '#047857', label: 'Research' },
  people: { stroke: '#6d28d9', label: 'People' },
};

const WIDTH = 720;
const HEIGHT = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 34 };

const shortMonth = (ym) => {
  const [y, m] = String(ym).split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleDateString(undefined, { month: 'short' });
};

export default function TrendChart({ months = [], series = {} }) {
  const keys = Object.keys(series).filter((k) => PALETTE[k]);

  if (!months.length || !keys.length) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No activity recorded yet.
      </p>
    );
  }

  const allValues = keys.flatMap((k) => series[k].map((p) => p.count));
  // Keep a non-zero ceiling so a flat all-zero chart still renders an axis
  // rather than dividing by zero.
  const max = Math.max(1, ...allValues);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const x = (i) =>
    PAD.left + (months.length === 1 ? plotW / 2 : (i / (months.length - 1)) * plotW);
  const y = (v) => PAD.top + plotH - (v / max) * plotH;

  // Four gridlines, rounded to whole items — fractional counts are meaningless.
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const uniqueTicks = [...new Set(ticks)];

  const total = allValues.reduce((a, b) => a + b, 0);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Content created per month over the last ${months.length} months. ${total} items in total.`}
      >
        {/* Gridlines and y-axis labels */}
        {uniqueTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(t)}
              y2={y(t)}
              stroke="#e4e4e7"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={y(t) + 3}
              textAnchor="end"
              fontSize="10"
              fill="#71717a"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X-axis labels, thinned so they never overlap */}
        {months.map((m, i) => {
          const step = Math.ceil(months.length / 12);
          if (i % step !== 0 && i !== months.length - 1) return null;
          return (
            <text
              key={m}
              x={x(i)}
              y={HEIGHT - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#71717a"
            >
              {shortMonth(m)}
            </text>
          );
        })}

        {/* One polyline per series */}
        {keys.map((key) => {
          const points = series[key]
            .map((p, i) => `${x(i)},${y(p.count)}`)
            .join(' ');

          return (
            <g key={key}>
              <polyline
                points={points}
                fill="none"
                stroke={PALETTE[key].stroke}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {series[key].map((p, i) => (
                <circle
                  key={p.month}
                  cx={x(i)}
                  cy={y(p.count)}
                  r="2.5"
                  fill={PALETTE[key].stroke}
                >
                  <title>{`${PALETTE[key].label} · ${p.month}: ${p.count}`}</title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>

      <figcaption className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {keys.map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: PALETTE[key].stroke }}
            />
            {PALETTE[key].label}
          </span>
        ))}
      </figcaption>

      {/* The same data as a table, for screen readers and for anyone who wants
          the exact figures. Visually hidden rather than removed. */}
      <table className="sr-only">
        <caption>Content created per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {keys.map((k) => (
              <th key={k} scope="col">
                {PALETTE[k].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((m, i) => (
            <tr key={m}>
              <th scope="row">{m}</th>
              {keys.map((k) => (
                <td key={k}>{series[k][i]?.count ?? 0}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
