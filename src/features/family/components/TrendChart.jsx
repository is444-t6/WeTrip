import { trendLayout } from '../chart'

// Month-end balance as a line. Months before the child had an account have no
// dot; the labels still run along the bottom so the gap reads as a gap.
export default function TrendChart({ points }) {
  const t = trendLayout(points)
  if (!t) return <p className="muted">No balance history yet.</p>

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${t.width} ${t.height}`} role="img" aria-label="Balance by month">
        <line className="chart-axis" x1="18" x2={t.width - 18} y1={t.baseY} y2={t.baseY} />
        {t.area && <path className="trend-area" d={t.area} />}
        {t.dots.length > 1 && <path className="trend-line" d={t.path} />}
        {t.dots.map((d) => (
          <circle key={d.label} className="trend-dot" cx={d.x} cy={d.y} r="3.5">
            <title>{`${d.label}: SGD ${d.value.toFixed(2)}`}</title>
          </circle>
        ))}
        {t.labels.map((l, i) => (
          <text key={i} className="chart-label" x={l.x} y={t.height - 6} textAnchor="middle">
            {l.text}
          </text>
        ))}
      </svg>
    </figure>
  )
}
