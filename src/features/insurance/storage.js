const DRAFT_KEY = 'wetrip.insurance.draft'
const PURCHASE_KEY = 'wetrip.insurance.purchaseResult'
const TRIP_KEY = 'wetrip.insurance.trip'

function read(key, fallback = null) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback
  } catch {
    return fallback
  }
}

export function getDraft() {
  return read(DRAFT_KEY, {})
}
export function saveDraft(draft) {
  sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}
export function getTrip() {
  return read(TRIP_KEY, {})
}
// An edit keeps the stored tripId only while its dates still match; an explicit
// trip.tripId (from the trip page) always wins.
export function saveTrip(trip) {
  const tripId = trip.tripId ?? tripIdFor(getTrip(), trip)
  sessionStorage.setItem(TRIP_KEY, JSON.stringify({ ...trip, tripId: tripId || undefined }))
}
export function getPurchaseResult() {
  return read(PURCHASE_KEY)
}
export function savePurchaseResult(result) {
  sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(result))
}
export function clearPurchaseResult() {
  sessionStorage.removeItem(PURCHASE_KEY)
}

// The trip page stores { tripId, startDate, endDate } before opening insurance. Only
// trust it when the checkout still covers exactly those dates.
export function tripIdFor(stored, trip) {
  if (!stored?.tripId || !trip) return 0
  return stored.startDate === trip.startDate && stored.endDate === trip.endDate
    ? Number(stored.tripId)
    : 0
}
