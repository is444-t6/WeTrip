
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { InsuranceApi } from './api'

export const insuranceKeys = {
  plans: ['insurance', 'plans'],
  policies: ['insurance', 'policies'],
}

export function useInsurancePlans() {
  return useQuery({
    queryKey: insuranceKeys.plans,
    queryFn: InsuranceApi.getPlans,
    staleTime: 5 * 60_000,
  })
}

export function useMyInsurance() {
  return useQuery({
    queryKey: insuranceKeys.policies,
    queryFn: InsuranceApi.getMyInsurance,
  })
}

export function useInsuranceQuote() {
  return useMutation({
    mutationFn: InsuranceApi.getQuote,
  })
}

export function usePurchaseInsurance() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: InsuranceApi.purchase,
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: insuranceKeys.policies,
      }),
  })
}
