import { serviceClient } from '../../lib/services'

// WeTrip_Trip_Composite: the flows that span SmartFX, Budget, Insurance, Family
// and the bank. Responses are normalised to camelCase by the client.
const { call, qs } = serviceClient('trip')

export const TripApi = {
  planTrip: (request) => call('POST', 'PlanTrip', request),
  getOverview: (tripId) => call('GET', `GetTripOverview${qs({ TripId: tripId })}`),
  // Moves money. User-triggered only, never retried; requestId makes a repeat a no-op.
  payOnTrip: (request) => call('POST', 'PayOnTrip', request),
  // The trip's child's miles, readable by the parent buying cover: { ChildBalance }.
  getTripMiles: (tripId) => call('GET', `GetTripMiles${qs({ TripId: tripId })}`),
  // Ledger write (SourceId 5); requestId makes a repeat a no-op.
  addFixedCost: (request) => call('POST', 'AddFixedCost', request),
  // carryToTripId moves the leftover to that trip's pot instead of valuing it; absent = just close.
  closeTrip: (tripId, carryToTripId) =>
    call('POST', `CloseTrip${qs({ TripId: tripId, CarryToTripId: carryToTripId })}`),
  // Read-only, parent only: leftover foreign money at today's rate vs the locked cost.
  getCloseOptions: (tripId) => call('GET', `GetCloseOptions${qs({ TripId: tripId })}`),
  // The caller's miles balance; the customer comes from the session token.
  getMyMiles: () => call('GET', 'GetMyMiles'),
  // A cash receipt: records a budget expense only, moves no money. requestId makes a repeat a no-op.
  addReceipt: (request) => call('POST', 'AddReceipt', request),
  getReceipt: (receiptId) => call('GET', `GetReceipt${qs({ ReceiptId: receiptId })}`),
}

// One id per payment attempt, kept for that attempt's lifetime, so a double tap
// or a resend of the same attempt is recognised by the server.
export const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
