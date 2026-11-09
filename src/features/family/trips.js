// Pure helpers for showing a child's SmartFX trips inside the Family screens.
// Field names are the camelCase ones FxApi returns (see features/fx/api.js).

const DAY_MS = 86_400_000
const ENDED = new Set(['Completed', 'Cancelled'])

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// 'YYYY-MM-DD' (or a full ISO string) as local midnight of that calendar date,
// so a trip starting "2027-04-01" starts on the 1st wherever the browser is.
export function parseDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value ?? ''))
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}

// Whole days from today to `value`; negative once it has passed.
export function daysUntil(value, now = new Date()) {
  const d = parseDay(value)
  return d ? Math.round((d - startOfDay(now)) / DAY_MS) : null
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function tripTiming(trip, now = new Date()) {
  const start = daysUntil(trip.tripStartDate, now)
  const end = daysUntil(trip.tripEndDate, now)
  if (start === null) return ''
  if (start > 1) return `in ${plural(start, 'day')}`
  if (start === 1) return 'tomorrow'
  if (start === 0) return 'starts today'
  if (end === null || end < 0) return 'ended'
  return end === 0 ? 'last day today' : `underway, ${plural(end, 'day')} left`
}

// The trip a family should be looking at next: not cancelled or completed,
// not over yet, earliest start first.
export function nextTrip(trips, now = new Date()) {
  return (
    (trips ?? [])
      .filter((t) => !ENDED.has(t.status) && (daysUntil(t.tripEndDate, now) ?? -1) >= 0)
      .sort((a, b) => parseDay(a.tripStartDate) - parseDay(b.tripStartDate))[0] ?? null
  )
}

export function statusBadge(status) {
  if (status === 'Watching') return 'pending'
  if (ENDED.has(status)) return 'removed'
  return 'active'
}

// How the locked money compares with buying the same foreign amount today.
// `forwardRate` is foreign units per SGD at today's forward rate, so a higher
// rate means each SGD now buys more: locking earlier then cost more.
export function lockSummary(trip, forwardRate) {
  const sgd = Number(trip.lockedSgd ?? 0)
  const foreign = Number(trip.lockedForeign ?? 0)
  if (!(sgd > 0 && foreign > 0)) return { state: 'none' }
  const avgRate = foreign / sgd
  const rate = Number(forwardRate ?? 0)
  if (!(rate > 0)) return { state: 'norate', avgRate, sgd, foreign }
  const todaySgd = foreign / rate
  const diff = sgd - todaySgd
  const state = Math.abs(diff) < 0.005 ? 'same' : diff > 0 ? 'costlier' : 'cheaper'
  return { state, avgRate, sgd, foreign, rate, todaySgd, diffSgd: Math.abs(diff) }
}

export function lockMessage(s, { currency, period }) {
  if (s.state === 'none') return 'Nothing locked yet.'
  const head = `Locked ${currency} ${s.foreign.toFixed(2)} for SGD ${s.sgd.toFixed(2)} (average rate ${s.avgRate.toFixed(4)}).`
  if (s.state === 'norate') return `${head} Today's rate is not available.`
  const tail = `At today's ${period} forward of ${s.rate.toFixed(4)} that would cost SGD ${s.todaySgd.toFixed(2)}`
  if (s.state === 'same') return `${head} ${tail}, about the same.`
  return s.state === 'costlier'
    ? `${head} ${tail}, so locking early cost SGD ${s.diffSgd.toFixed(2)} more.`
    : `${head} ${tail}, so locking early saved SGD ${s.diffSgd.toFixed(2)}.`
}

// Foreign money still to spend on the trip: what was locked, less what the
// child has already spent from the trip wallet.
export function foreignLeft(trip, spends) {
  const locked = Number(trip.lockedForeign ?? 0)
  const spent = (spends ?? []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  return {
    locked,
    spent,
    left: Math.max(0, locked - spent),
    pct: locked > 0 ? Math.min(100, (spent / locked) * 100) : 0,
  }
}
