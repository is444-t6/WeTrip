import { getSessionCustomerId } from '../auth/session'

// ===========================================================================
// DEMO CUSTOMER: used when nobody is signed in. Change or remove it here once
// WeTrip has a real login; nothing else in this feature needs to change.
// ===========================================================================
export const DEMO_CUSTOMER_ID = '0000002996'

export function getCustomerId() {
  return getSessionCustomerId() || DEMO_CUSTOMER_ID
}
