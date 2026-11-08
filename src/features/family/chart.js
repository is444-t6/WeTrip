// Pure layout for the two small charts. They return coordinates in a fixed
// viewBox; the components only draw them.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const monthLabel = (yearMonth) => MONTHS[Number(String(yearMonth).slice(5, 7)) - 1] ?? ''

// Balance by month as a line from zero up. Months with no balance (before the
// child had an account) leave a gap in the dots and the line skips over them.
export function trendLayout(
  points,
  { width = 320, height = 130, padX = 18, padTop = 14, padBottom = 24 } = {},
) {
  const pts = points ?? []
  const values = pts.map((p) => (p.balance == null ? null : Number(p.balance)))
  const known = values.filter((v) => v !== null)
  if (known.length === 0) return null

  const max = Math.max(...known, 1)
  const innerW = width - padX * 2
  const innerH = height - padTop - padBottom
  const x = (i) => (pts.length > 1 ? padX + (i * innerW) / (pts.length - 1) : padX + innerW / 2)
  const y = (v) => padTop + innerH - (v / max) * innerH
  const baseY = padTop + innerH

  const dots = values
    .map((v, i) =>
      v === null ? null : { x: x(i), y: y(v), value: v, label: monthLabel(pts[i].yearMonth) },
    )
    .filter(Boolean)
  const path = dots.map((d, i) => `${i ? 'L' : 'M'}${d.x.toFixed(1)} ${d.y.toFixed(1)}`).join(' ')
  const area =
    dots.length > 1
      ? `${path} L${dots.at(-1).x.toFixed(1)} ${baseY} L${dots[0].x.toFixed(1)} ${baseY} Z`
      : ''
  const labels = pts.map((p, i) => ({ x: x(i), text: monthLabel(p.yearMonth) }))
  return { width, height, dots, path, area, labels, max, baseY }
}

// One bar per day, scaled so the tallest of the bars and the daily limit fits.
export function barsLayout(
  days,
  { width = 320, height = 120, padX = 8, padTop = 12, padBottom = 22, limit = 0 } = {},
) {
  const list = days ?? []
  if (list.length === 0) return null

  const max = Math.max(...list.map((d) => d.total), Number(limit) || 0, 1)
  const innerW = width - padX * 2
  const innerH = height - padTop - padBottom
  const slot = innerW / list.length
  const w = Math.max(2, Math.min(22, slot * 0.7))
  const baseY = padTop + innerH

  const bars = list.map((d, i) => {
    const h = (d.total / max) * innerH
    return { date: d.date, total: d.total, x: padX + i * slot + (slot - w) / 2, y: baseY - h, w, h }
  })
  const limitY = limit > 0 ? baseY - (limit / max) * innerH : null
  return { width, height, bars, max, limitY, baseY, padX }
}
