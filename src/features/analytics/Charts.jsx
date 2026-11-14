import { monthLabel } from '../family/chart'
import { money } from '../../lib/format'
import Money from '../../components/Money'

const monthText = (m) => `${monthLabel(m)} ${String(m).slice(2, 4)}`

// One bar per month. With negative values the zero line moves up and bars below
// it read as the opposite (here: locking cost money), in the danger colour.
export function MonthBars({ points, label, caption }) {
  if (!points.length) return null
  const width = 320
  const height = 140
  const padX = 8
  const padTop = 10
  const padBottom = 22
  const values = points.map((p) => p.value)
  const max = Math.max(0, ...values)
  const min = Math.min(0, ...values)
  const span = max - min || 1
  const innerH = height - padTop - padBottom
  const y = (v) => padTop + ((max - v) / span) * innerH
  const zeroY = y(0)
  const slot = (width - padX * 2) / points.length
  const w = Math.max(3, Math.min(28, slot - 2))
  const labelAll = points.length <= 6

  return (
    <figure className="chart chart-capped">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        {points.map((p, i) => {
          const x = padX + i * slot + (slot - w) / 2
          const top = Math.min(y(p.value), zeroY)
          const h = Math.max(p.value ? 1 : 0, Math.abs(y(p.value) - zeroY))
          return (
            <g key={p.month}>
              <rect
                className={p.value < 0 ? 'bar bar-over' : 'bar'}
                x={x}
                y={top}
                width={w}
                height={h}
                rx="2"
              />
              {/* A full-height hit target, bigger than the bar, carries the tooltip. */}
              <rect
                className="chart-hit"
                x={padX + i * slot}
                y={padTop}
                width={slot}
                height={innerH}
              >
                <title>{`${monthText(p.month)}: ${money(p.value)}`}</title>
              </rect>
              {(labelAll || i === 0 || i === points.length - 1) && (
                <text
                  className="chart-label"
                  x={x + w / 2}
                  y={height - 6}
                  textAnchor={labelAll ? 'middle' : i === 0 ? 'start' : 'end'}
                >
                  {monthText(p.month)}
                </text>
              )}
            </g>
          )
        })}
        <line className="chart-axis" x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} />
      </svg>
      {caption && <figcaption className="muted">{caption}</figcaption>}
    </figure>
  )
}

// Labelled horizontal bars (single series): name, bar scaled to the largest, value.
export function HBars({ items, label }) {
  if (!items.length) return <p className="muted">Nothing in this filter.</p>
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="hbars" aria-label={label}>
      {items.map((i) => (
        <li key={i.label} className="hbar-row">
          <span className="hbar-name">{i.label}</span>
          <span className="hbar-track" aria-hidden="true">
            <span className="hbar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </span>
          <Money amount={i.value} />
        </li>
      ))}
    </ul>
  )
}

// A 0-100 share as a filled track.
export function Meter({ pct, label }) {
  return (
    <span className="hbar-track meter" role="img" aria-label={label}>
      <span className="hbar-fill bar-over-fill" style={{ width: `${Math.min(100, pct)}%` }} />
    </span>
  )
}
