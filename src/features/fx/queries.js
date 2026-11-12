import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FxApi } from './api'
import { useChildren } from '../family/queries'
import { isLoggedIn } from '../auth/session'

export const fxKeys = {
  trips: ['fx', 'trips'],
  trip: (id) => ['fx', 'trip', id],
  rate: (currency, period) => ['fx', 'rate', currency, period],
}

export const useTrips = () => {
  const { data: children } = useChildren()
  const linkIds = (children || []).filter((c) => c.status === 'Active').map((c) => c.familyLinkId)

  return useQuery({
    queryKey: [...fxKeys.trips, linkIds.join(',')],
    queryFn: async () => {
      const lists = await Promise.all(linkIds.map((id) => FxApi.getTrips(id)))
      return lists.flat()
    },
    enabled: isLoggedIn() && linkIds.length > 0,
  })
}

export const useTrip = (tripId) =>
  useQuery({
    queryKey: fxKeys.trip(tripId),
    queryFn: () => FxApi.getTrip(tripId),
    enabled: isLoggedIn() && Boolean(tripId),
  })

export const useRate = (currency, period) =>
  useQuery({
    queryKey: fxKeys.rate(currency, period),
    queryFn: () => FxApi.getRate(currency, period),
    enabled: isLoggedIn() && Boolean(currency),
    staleTime: 60_000,
  })

function useInvalidate() {
  const qc = useQueryClient()
  return (tripId) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: fxKeys.trips }),
      tripId != null && qc.invalidateQueries({ queryKey: fxKeys.trip(tripId) }),
    ])
}

export function useCancelTrip() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: FxApi.cancelTrip,
    onSuccess: (_d, id) => invalidate(id),
  })
}

export function useLockNow() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: FxApi.lockNow,
    onSuccess: (_d, v) => invalidate(v.tripId),
  })
}

export function useCheckRates() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: FxApi.checkRatesNow,
    onSuccess: () => qc.invalidateQueries({ queryKey: fxKeys.trips }),
  })
}
