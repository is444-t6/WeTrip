import { serviceClient } from '../../lib/services'

// WeTrip_Trip_Composite: the flows that span SmartFX, Budget, Insurance, Family
// and the bank. Responses are normalised to camelCase by the client.
const { call, qs } = serviceClient('trip')

export const TripApi = {
  planTrip: (request) => call('POST', 'PlanTrip', request),
  getOverview: (tripId) => call('GET', `GetTripOverview${qs({ TripId: tripId })}`),
  // Moves money. User-triggered only, never retried; requestId makes a repeat a no-op.
  payOnTrip: (request) => call('POST', 'PayOnTrip', request),
  // Ledger write (SourceId 5); requestId makes a repeat a no-op.
  addFixedCost: (request) => call('POST', 'AddFixedCost', request),
  closeTrip: (tripId) => call('POST', `CloseTrip${qs({ TripId: tripId })}`),
}

// One id per payment attempt, kept for that attempt's lifetime, so a double tap
// or a resend of the same attempt is recognised by the server.
export const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `req-${Date.now()}-${Math.random().toString(36).slice(2)}`
