// Pure helpers for the home page. No React and no fetching.

const ENDED = new Set(['Completed', 'Cancelled'])

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

// Foreign money already set aside for each trip that has not finished: one
// entry per trip, soonest first, skipping trips with nothing locked yet.
export function tripWallets(trips) {
  return (trips ?? [])
    .filter((t) => !ENDED.has(t.status) && Number(t.lockedForeign) > 0)
    .sort((a, b) => String(a.tripStartDate).localeCompare(String(b.tripStartDate)))
    .map((t) => ({
      tripId: t.tripId,
      destination: t.destination,
      currency: t.currency,
      amount: Number(t.lockedForeign),
    }))
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
