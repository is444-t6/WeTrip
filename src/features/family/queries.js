import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FamilyApi } from './api'
import { isLoggedIn } from './session'

// Every read is a query, every write is a mutation that invalidates the keys
// it can affect. `enabled: isLoggedIn()` replaces the old conditional effects.

export const keys = {
  role: ['family', 'role'],
  me: ['family', 'me'],
  children: ['family', 'children'],
  requests: ['family', 'requests'],
  invite: ['family', 'invite'],
  accounts: ['family', 'accounts'],
  dash: ['family', 'dash'],
  expenses: (id, from, to) => ['family', 'expenses', id, from, to],
  trend: (id, months) => ['family', 'trend', id, months],
}

const authed = () => ({ enabled: isLoggedIn() })

export function useRole() {
  return useQuery({
    queryKey: keys.role,
    queryFn: FamilyApi.getMyFamilyRole,
    select: (r) => r.role,
    ...authed(),
  })
}

export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: FamilyApi.getMe, ...authed() })

export const useChildren = () =>
  useQuery({ queryKey: keys.children, queryFn: FamilyApi.getChildren, ...authed() })

export const usePendingRequests = () =>
  useQuery({ queryKey: keys.requests, queryFn: FamilyApi.getPendingRequests, ...authed() })

export const useMyInvite = () =>
  useQuery({ queryKey: keys.invite, queryFn: FamilyApi.getMyLinkInvite, ...authed() })

export const useAccounts = () =>
  useQuery({ queryKey: keys.accounts, queryFn: FamilyApi.getMyAccounts, ...authed() })

export const useChildDashboard = () =>
  useQuery({ queryKey: keys.dash, queryFn: FamilyApi.getChildDashboard, ...authed() })

export const useChildExpenses = (familyLinkId, startDate, endDate) =>
  useQuery({
    queryKey: keys.expenses(familyLinkId, startDate, endDate),
    queryFn: () => FamilyApi.getChildExpenses(familyLinkId, startDate, endDate),
    ...authed(),
  })

export const useBalanceTrend = (familyLinkId, months) =>
  useQuery({
    queryKey: keys.trend(familyLinkId, months),
    queryFn: () => FamilyApi.getBalanceTrend(familyLinkId, months),
    ...authed(),
  })

function useInvalidate() {
  const qc = useQueryClient()
  return (...groups) =>
    Promise.all(groups.map((g) => qc.invalidateQueries({ queryKey: keys[g] ?? g })))
}

export function useFindCustomer() {
  return useMutation({
    mutationFn: ({ countryCode, phoneNumber }) =>
      FamilyApi.findCustomerByPhone(countryCode, phoneNumber),
  })
}

export function useLinkChild() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: FamilyApi.linkChild,
    onSuccess: () => invalidate('children', 'requests', 'me'),
  })
}

export function useAcceptLink() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ familyLinkId, accountId }) => FamilyApi.acceptLink(familyLinkId, accountId),
    onSuccess: () => invalidate('invite', 'role', 'dash'),
  })
}

export function useDecideRequest() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ requestId, approve }) => FamilyApi.decideRequest(requestId, approve),
    onSuccess: () => invalidate('requests', 'children', 'me'),
  })
}

export function useSetBudget() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ familyLinkId, period, amount }) =>
      FamilyApi.setBudget(familyLinkId, period, amount),
    onSuccess: () => invalidate('children', 'dash'),
  })
}

export function useSetupAllowance() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ familyLinkId, amount, weeklyMonthly, startDate }) =>
      FamilyApi.setupAllowance(familyLinkId, amount, weeklyMonthly, startDate),
    onSuccess: () => invalidate('children'),
  })
}

export function useStopAllowance() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (familyLinkId) => FamilyApi.stopAllowance(familyLinkId),
    onSuccess: () => invalidate('children'),
  })
}

export function useTopUp() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ familyLinkId, amount, narrative }) =>
      FamilyApi.topUp(familyLinkId, amount, narrative),
    onSuccess: () => invalidate('children', 'me'),
  })
}

export function useChildSpend() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ merchantAccountId, amount, category, narrative }) =>
      FamilyApi.childSpend(merchantAccountId, amount, category, narrative),
    onSuccess: () => invalidate('dash'),
  })
}
