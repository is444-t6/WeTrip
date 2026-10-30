import { getSessionToken } from './session'

const BASE = import.meta.env.VITE_FAMILY_API_BASE
const API_KEY = import.meta.env.VITE_FAMILY_API_KEY

// Family_Composite's Name-in-JSON fixes (Task 11.3) are landing structure by
// structure on the backend, so some responses are still PascalCase where the
// spec calls for camelCase. Rather than special-case every screen, every
// response gets a lowercase-first alias added for each key — so code written
// against the spec (familyLinkId, status, ...) works whether the backend has
// been fixed yet or not. Safe to delete once every structure's Name in JSON
// is confirmed fixed.
function lowerFirst(key) {
  return key.charAt(0).toLowerCase() + key.slice(1)
}

function withCamelAliases(value) {
  if (Array.isArray(value)) return value.map(withCamelAliases)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [key, raw] of Object.entries(value)) {
      const normalized = withCamelAliases(raw)
      out[key] = normalized
      const alias = lowerFirst(key)
      if (alias !== key && !(alias in out)) out[alias] = normalized
    }
    return out
  }
  return value
}

async function call(method, path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Contacts-Key': API_KEY,
      'X-Session-Token': getSessionToken(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.Errors?.[0] || `Request failed (${res.status})`
    throw new Error(message)
  }
  return withCamelAliases(data)
}

function qs(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (entries.length === 0) return ''
  return '?' + new URLSearchParams(entries).toString()
}

// Every key below is the exact "Name in JSON" from the build guide's Task 11.3
// structure tables (all lowercase-first camelCase) — the guide's own sample
// api.js used PascalCase in a few spots (FamilyLinkId, Phone, Role, ...),
// which OutSystems would silently fail to map. Fixed here.
export const FamilyApi = {
  // Role, profile
  getMyFamilyRole: () => call('GET', 'GetMyFamilyRole'),
  getMe: () => call('GET', 'GetMe'),
  getMyAccounts: () => call('GET', 'GetMyAccounts'),

  // Linking
  findCustomerByPhone: (countryCode, phoneNumber) =>
    call('GET', `FindCustomerByPhone${qs({ countryCode, phoneNumber })}`),
  linkChild: ({ childCustomerId, nickname, hostCurrency }) =>
    call('POST', 'LinkChild', { childCustomerId, nickname, hostCurrency }),
  getMyLinkInvite: () => call('GET', 'GetMyLinkInvite'),
  acceptLink: (familyLinkId, accountId) =>
    call('POST', 'AcceptLink', { familyLinkId, accountId }),

  // Parent: children, budget, allowance, top-up
  getChildren: () => call('GET', 'GetChildren'),
  setBudget: (familyLinkId, period, amount) =>
    call('POST', 'SetBudget', { familyLinkId, period, amount }),
  setupAllowance: (familyLinkId, amount, weeklyMonthly, startDate) =>
    call('POST', 'SetupAllowance', { familyLinkId, amount, weeklyMonthly, startDate }),
  stopAllowance: (familyLinkId) =>
    call('POST', 'StopAllowance', { familyLinkId }),
  topUp: (familyLinkId, amount, narrative) =>
    call('POST', 'TopUp', { familyLinkId, amount, narrative }),

  // Child: dashboard, spending
  getChildDashboard: () => call('GET', 'GetChildDashboard'),
  childSpend: (merchantAccountId, amount, category, narrative) =>
    call('POST', 'ChildSpend', { merchantAccountId, amount, category, narrative }),

  // Parent: approvals
  getPendingRequests: () => call('GET', 'GetPendingRequests'),
  decideRequest: (requestId, approve) =>
    call('POST', 'DecideRequest', { requestId, approve }),

  // Parent: expenses, balance trend
  getChildExpenses: (familyLinkId, startDate, endDate) =>
    call('GET', `GetChildExpenses${qs({ familyLinkId, startDate, endDate })}`),
  getBalanceTrend: (familyLinkId, months = 6) =>
    call('GET', `GetBalanceTrend${qs({ familyLinkId, months })}`),
}
