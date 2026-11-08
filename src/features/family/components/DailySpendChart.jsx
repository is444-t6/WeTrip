import { barsLayout, monthLabel } from '../chart'

const shortDate = (d) => `${Number(String(d).slice(8, 10))} ${monthLabel(d)}`

// Spending per day so far this period. Days above the safe daily amount turn
// red, so one expensive day stands out from a steady pace.
export default function DailySpendChart({ days, limit = 0 }) {
  const layout = barsLayout(days, { limit })
  if (!layout) return null
  const { width, height, bars, limitY, baseY, padX } = layout
  const first = bars[0]
  const last = bars.at(-1)

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Spending per day this period">
        <line className="chart-axis" x1={padX} x2={width - padX} y1={baseY} y2={baseY} />
        {limitY !== null && (
          <line className="chart-limit" x1={padX} x2={width - padX} y1={limitY} y2={limitY} />
        )}
        {bars.map((b) => (
          <rect
            key={b.date}
            className={limit > 0 && b.total > limit ? 'bar bar-over' : 'bar'}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx="2"
          >
            <title>{`${shortDate(b.date)}: SGD ${b.total.toFixed(2)}`}</title>
          </rect>
        ))}
        <text className="chart-label" x={first.x} y={height - 6}>
          {shortDate(first.date)}
        </text>
        {bars.length > 1 && (
          <text className="chart-label" x={last.x + last.w} y={height - 6} textAnchor="end">
            {shortDate(last.date)}
          </text>
        )}
      </svg>
      {limit > 0 && (
        <figcaption className="muted">
          Dashed line: SGD {limit.toFixed(2)} a day keeps the budget on track.
        </figcaption>
      )}
    </figure>
  )
}
