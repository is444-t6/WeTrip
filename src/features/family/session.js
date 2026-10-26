// Dev-only session handling (Task 12.4 Option C: ValidateSessionStub).
// Swap this out once WeTrip's real login writes a real session token into
// the same sessionStorage key — nothing else in this feature needs to change.

const KEY = 'wetrip_session'

export function getSessionToken() {
  return sessionStorage.getItem(KEY) || ''
}

export function setDevSession(customerId, accountId, displayName) {
  const token = `${customerId}:${accountId}:${displayName || ''}`
  sessionStorage.setItem(KEY, token)
  return token
}

export function clearSession() {
  sessionStorage.removeItem(KEY)
}

export function isLoggedIn() {
  return getSessionToken() !== ''
}
