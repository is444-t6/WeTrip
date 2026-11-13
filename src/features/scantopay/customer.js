import { getSessionCustomerId } from '../auth/session'

// Scan to Pay is per customer: with nobody signed in there is no customer, and
// callers must not query or pay.
export const getCustomerId = getSessionCustomerId
