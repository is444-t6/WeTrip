// How money, rates and dates read everywhere in the app. Pure functions only.

// "SGD 1,234.50", "JPY 96,675.38": grouped digits and always two decimals.
// Yen has no cents, but the trip pot is a ledger that does, and rounding it
// would hide money. Intl puts a no-break space after the code; a plain one
// copies and tests more predictably.
export function money(amount, currency = 'SGD') {
  const n = Number(amount ?? 0)
  try {
    return new Intl.NumberFormat('en-SG', {
      style: 'currency',
      currency: currency || 'SGD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
      .format(n)
      .replace(/\s/g, ' ')
  } catch {
    return `${currency || 'SGD'} ${n.toFixed(2)}`
  }
}

// Rates are foreign units per 1 SGD. Two decimals read well for JPY-sized
// numbers; GBP or CHF (under 10) need four to show any movement.
export function rate(value) {
  const n = Number(value)
  if (!n) return '—'
  return n.toFixed(n >= 10 ? 2 : 4)
}

// "1 SGD = 121.02 JPY", so the direction of a rate is never a guess.
export const rateText = (value, currency) =>
  Number(value) ? `1 SGD = ${rate(value)} ${currency}` : '—'

// Date-only values ("2027-04-01" or "2027-04-01T00:00:00") are calendar days:
// read and print them in UTC so no timezone can move them a day.
const asDay = (value) => {
  const d = new Date(`${String(value ?? '').slice(0, 10)}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}
const fmt = (d, opts) => d.toLocaleDateString('en-SG', { timeZone: 'UTC', ...opts })

// "1 Apr 2027"
export function day(value) {
  const d = asDay(value)
  return d ? fmt(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}

// "1–14 Apr 2027", "28 Mar – 4 Apr 2027", "28 Dec 2026 – 4 Jan 2027".
export function dayRange(start, end) {
  const a = asDay(start)
  const b = asDay(end)
  if (!a || !b) return a ? day(start) : '—'
  const year = { year: 'numeric' }
  if (a.getUTCFullYear() !== b.getUTCFullYear()) return `${day(start)} – ${day(end)}`
  if (a.getUTCMonth() !== b.getUTCMonth()) {
    return `${fmt(a, { day: 'numeric', month: 'short' })} – ${day(end)}`
  }
  return `${a.getUTCDate()}–${fmt(b, { day: 'numeric', month: 'short', ...year })}`
}
