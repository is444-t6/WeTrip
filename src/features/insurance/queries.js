
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { keys as familyKeys } from '../family/queries'
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

export function useInsurancePlanBenefits(insurancePlanId) {
  return useQuery({
    queryKey: [...insuranceKeys.plans, String(insurancePlanId), 'benefits'],
    queryFn: () => InsuranceApi.getBenefits(insurancePlanId),
    enabled: insurancePlanId != null && String(insurancePlanId) !== '',
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
    onSuccess: (result) => {
      if (result?.paymentSuccess !== true) return

      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: insuranceKeys.policies,
        }),
        queryClient.invalidateQueries({
          queryKey: familyKeys.me,
        }),
      ])
    },
  })
}
