import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ScanToPayApi } from './api'

const historyKey = (customerId) => ['scantopay', 'history', customerId]

export const useHistory = (customerId) =>
  useQuery({
    queryKey: historyKey(customerId),
    queryFn: () => ScanToPayApi.getHistory(customerId),
    enabled: Boolean(customerId),
  })

export const usePreview = () => useMutation({ mutationFn: ScanToPayApi.previewPayment })

// Payments never retry, because a retry could charge the customer twice. History
// refreshes on failure too: the bank may have finished after the request died.
function usePayment(mutationFn, customerId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSettled: () => qc.invalidateQueries({ queryKey: historyKey(customerId) }),
  })
}

export const usePayNow = (customerId) => usePayment(ScanToPayApi.payNow, customerId)
export const usePayLater = (customerId) => usePayment(ScanToPayApi.payLater, customerId)
