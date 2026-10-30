import { createClient } from '../../lib/http'

const { call, qs } = createClient({
  base: import.meta.env.VITE_FAMILY_API_BASE,
  apiKey: import.meta.env.VITE_FAMILY_API_KEY,
  normalize: true,
})

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
