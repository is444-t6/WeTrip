import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isLoggedIn } from '../auth/session'
import { TripApi } from './api'

export const tripKeys = {
  overview: (tripId) => ['trip', 'overview', String(tripId)],
}

export const useTripOverview = (tripId) =>
  useQuery({
    queryKey: tripKeys.overview(tripId),
    queryFn: () => TripApi.getOverview(tripId),
    enabled: isLoggedIn() && Boolean(tripId),
  })

export const useTripMiles = (tripId) =>
  useQuery({
    queryKey: ['trip', 'miles', String(tripId)],
    queryFn: () => TripApi.getTripMiles(tripId),
    enabled: isLoggedIn() && Boolean(tripId),
    retry: false,
  })

// A trip change shows up on SmartFX lists, the budget page and the family cards too.
function refreshTripViews(qc, tripId) {
  qc.invalidateQueries({ queryKey: ['trip'] })
  qc.invalidateQueries({ queryKey: ['fx'] })
  qc.invalidateQueries({ queryKey: ['family'] })
  if (tripId) qc.invalidateQueries({ queryKey: ['budget', 'dashboard', String(tripId)] })
}

export function usePlanTrip() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: TripApi.planTrip,
    onSuccess: (trip) => refreshTripViews(qc, trip?.id),
  })
}

export function usePayOnTrip(tripId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: TripApi.payOnTrip,
    retry: false,
    // Refresh even on failure: the bank may have finished after the response was lost.
    onSettled: () => refreshTripViews(qc, tripId),
  })
}

export function useCloseTrip(tripId) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => TripApi.closeTrip(tripId),
    onSuccess: () => refreshTripViews(qc, tripId),
  })
}
