import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BudgetApi } from './api'

const dashboardKey = (tripId) => ['budget', 'dashboard', String(tripId)]

export const useDashboard = (tripId) =>
  useQuery({
    queryKey: dashboardKey(tripId),
    queryFn: () => BudgetApi.getDashboard(tripId),
    enabled: !!tripId,
  })

export function useRecordSpending(tripId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: BudgetApi.recordSpending,
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(tripId) }),
  })
}

export function useSetBudget(tripId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: BudgetApi.setBudget,
    onSuccess: () => qc.invalidateQueries({ queryKey: dashboardKey(tripId) }),
  })
}
