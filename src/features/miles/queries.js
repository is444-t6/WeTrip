import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MilesApi } from './api'

const milesKey = (customerId) => ['miles', 'mine', customerId]

export const useMyMiles = (customerId) =>
  useQuery({
    queryKey: milesKey(customerId),
    queryFn: MilesApi.getMyMiles,
    enabled: Boolean(customerId),
  })

export const useRewards = () =>
  useQuery({ queryKey: ['miles', 'rewards'], queryFn: MilesApi.getRewards, staleTime: 5 * 60_000 })

// Both writes refresh the balance and history afterwards, even on failure,
// because the backend may have finished after the request died.
function useMilesWrite(mutationFn, customerId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSettled: () => qc.invalidateQueries({ queryKey: milesKey(customerId) }),
  })
}

export const useSyncMiles = (customerId) => useMilesWrite(MilesApi.sync, customerId)

// Never retried: a cashback redemption moves real sandbox money.
export const useRedeem = (customerId) => useMilesWrite(MilesApi.redeem, customerId)
