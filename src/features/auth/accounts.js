import { serviceClient } from '../../lib/services'

// The dev sign-in is given only a customer id, but a session needs an account
// too. GetMyAccounts reads just the customer id from the session token, so a
// token with that id and no account is enough to ask which accounts the
// customer has. The client is built per lookup with its own token, so nothing
// is written to the stored session until the sign-in actually succeeds.
export function fetchAccounts(customerId) {
  const { call } = serviceClient('family', { getToken: () => `${customerId}::` })
  return call('GET', 'GetMyAccounts')
}

// GetMyAccounts carries no name, so ask GetMe once the account is known. The name
// is a nicety: any failure just means no name, never a failed sign-in. The token
// rides in an HTTP header, so a name with characters outside printable ASCII is dropped.
export async function fetchDisplayName(customerId, accountId) {
  const { call } = serviceClient('family', { getToken: () => `${customerId}:${accountId}:` })
  try {
    const { displayName } = await call('GET', 'GetMe')
    return /^[ -~]+$/.test(displayName ?? '') ? displayName : ''
  } catch {
    return ''
  }
}

// The account a customer pays from and is paid into: an open SGD current
// account. Loans, term deposits and foreign-currency wallets are not it.
export function depositAccounts(accounts) {
  return (Array.isArray(accounts) ? accounts : []).filter(
    (a) =>
      a.accountId &&
      a.productName === 'CASA' &&
      a.currency === 'SGD' &&
      a.currentStatus !== 'Closed',
  )
}

export function accountLabel(account) {
  return `${account.accountId} · ${account.currency} ${Number(account.balance ?? 0).toFixed(2)}`
}

// What to tell someone when the lookup fails.
export function lookupMessage(error) {
  const message = error?.message ?? ''
  if (/not found/i.test(message)) return "We couldn't find a customer with that id."
  return message || 'Something went wrong. Please try again.'
}
