// Pure helpers for the home page. No React and no fetching.

// "Parent Demo" and "timothy.loo" both greet well: the first word, capitalised.
export function firstName(displayName, fallback = 'there') {
  const word = String(displayName ?? '')
    .trim()
    .split(/[\s._-]+/)[0]
  return word ? word.charAt(0).toUpperCase() + word.slice(1) : fallback
}

// Account numbers are shown by their last four digits only.
export function maskAccount(id) {
  const s = String(id ?? '')
  return s.length > 4 ? `····${s.slice(-4)}` : s
}

const DAY = 86_400_000
const dayNumber = (value) => Math.floor(Date.parse(String(value ?? '').slice(0, 10)) / DAY)

const localDay = (today) => Math.floor((today.getTime() - today.getTimezoneOffset() * 60_000) / DAY)

// A trip stays open until the parent closes it, so one whose end date has
// passed is over even while its status still says Locked or Spending.
export function tripOver(trip, today = new Date()) {
  return dayNumber(trip?.tripEndDate) < localDay(today)
}

// "In 12 days", "Tomorrow", "Starts today", "On now", "Trip over": how far off
// a trip is. Dates are compared as calendar days, so the time of day never
// shifts the count.
export function tripCountdown(trip, today = new Date()) {
  const start = dayNumber(trip?.tripStartDate)
  if (Number.isNaN(start)) return ''
  if (tripOver(trip, today)) return 'Trip over'
  const days = start - localDay(today)
  if (days > 1) return `In ${days} days`
  if (days === 1) return 'Tomorrow'
  if (days === 0) return 'Starts today'
  return 'On now'
}

// Newest payments first. History arrives in the backend's order, which the
// home page must not depend on.
export function latestPayments(payments, count = 3) {
  return [...(payments ?? [])]
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))
    .slice(0, count)
}

export function totalChildBalance(children) {
  return (children ?? [])
    .filter((c) => c.status === 'Active')
    .reduce((sum, c) => sum + Number(c.balance ?? 0), 0)
}
