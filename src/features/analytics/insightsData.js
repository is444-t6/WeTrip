// Pure shaping for the insights charts: filter the mart's currency/month rows,
// then roll them up. Months are 'YYYY-MM' (SGT), as GetInsights sends them.

export const PERIODS = [
  { id: 'all', label: 'All time', months: 0 },
  { id: '12m', label: '12 months', months: 12 },
  { id: '3m', label: '3 months', months: 3 },
]

const ym = (m) => String(m ?? '').slice(0, 7)
const num = (v) => Number(v) || 0

// 'YYYY-MM' n months before `from` (also 'YYYY-MM').
export function monthsBack(from, n) {
  const [y, m] = from.split('-').map(Number)
  const t = y * 12 + (m - 1) - n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

// The first month a period keeps, counting the current month as one of them.
export const periodStart = (period, nowYm) => {
  const p = PERIODS.find((x) => x.id === period)
  return p?.months ? monthsBack(nowYm, p.months - 1) : ''
}

export const keep = (row, { currency, start }) =>
  (currency === 'all' || row.currency === currency) && ym(row.month) >= start

// Every month from the first to the last present, gaps filled with zero, so the
// time axis is honest.
export function monthSeries(rows) {
  const by = new Map()
  for (const r of rows) {
    const k = ym(r.month)
    const cur = by.get(k) ?? { month: k, spend: 0, saved: 0 }
    cur.spend += num(r.spendSgd)
    cur.saved += num(r.savedVsSpotSgd)
    by.set(k, cur)
  }
  const months = [...by.keys()].sort()
  if (!months.length) return []
  const out = []
  for (let m = months[0]; m <= months.at(-1); m = monthsBack(m, -1)) {
    out.push(by.get(m) ?? { month: m, spend: 0, saved: 0 })
  }
  return out
}

// Sum `spendSgd` by a key, largest first.
export function totalsBy(rows, key) {
  const by = new Map()
  for (const r of rows) by.set(r[key], (by.get(r[key]) ?? 0) + num(r.spendSgd))
  return [...by]
    .map(([label, value]) => ({ label, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)
}

export const currenciesIn = (rows) =>
  [...new Set(rows.map((r) => r.currency))].filter(Boolean).sort()
