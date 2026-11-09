import { periodTiming } from '../insights'

// Budget progress with a tick where spending would be if it were spread evenly
// across the period. A fill past the tick means spending faster than the
// calendar, which a plain bar cannot show.
export default function PaceBar({ spent, budget, bounds }) {
  const b = Number(budget ?? 0)
  const s = Number(spent ?? 0)
  const pct = b > 0 ? Math.min(100, (s / b) * 100) : 0
  const over = b > 0 && s >= b
  const { elapsedPct } = periodTiming(bounds)

  return (
    <div className="pace">
      <div className={`progress ${over ? 'over' : ''}`}>
        <div style={{ width: `${pct}%` }} />
      </div>
      {b > 0 && !over && (
        <span
          className="pace-tick"
          style={{ left: `${elapsedPct}%` }}
          title="Where spending would be if spread evenly over the period"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
