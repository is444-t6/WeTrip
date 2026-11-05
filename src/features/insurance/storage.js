const DRAFT_KEY = 'wetrip.insurance.draft'
const PURCHASE_KEY = 'wetrip.insurance.purchaseResult'
const TRIP_KEY = 'wetrip.insurance.trip'

function read(key, fallback = null) {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null') ?? fallback } catch { return fallback }
}

export function getDraft() { return read(DRAFT_KEY, {}) }
export function saveDraft(draft) { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)) }
export function getTrip() { return read(TRIP_KEY, {}) }
export function saveTrip(trip) { sessionStorage.setItem(TRIP_KEY, JSON.stringify(trip)) }
export function getPurchaseResult() { return read(PURCHASE_KEY) }
export function savePurchaseResult(result) { sessionStorage.setItem(PURCHASE_KEY, JSON.stringify(result)) }
export function clearPurchaseResult() { sessionStorage.removeItem(PURCHASE_KEY) }
