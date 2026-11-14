import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isLoggedIn } from '../auth/session'
import { AnalyticsApi } from './api'

export const analyticsKeys = { insights: ['analytics', 'insights'] }

// Polls every 3 s while a run is Running, and only then. Polling is a read.
export const useInsights = () =>
  useQuery({
    queryKey: analyticsKeys.insights,
    queryFn: AnalyticsApi.getInsights,
    enabled: isLoggedIn(),
    refetchInterval: (query) => (query.state.data?.lastRun?.status === 'Running' ? 3000 : false),
  })

export function useRunEtlNow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: AnalyticsApi.runEtlNow,
    retry: false,
    // Returned, so the mutation stays pending until the refetch shows the new run.
    onSuccess: () => qc.invalidateQueries({ queryKey: analyticsKeys.insights }),
  })
}
