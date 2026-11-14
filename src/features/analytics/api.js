import { serviceClient } from '../../lib/services'

// WeTrip_Analytics_Composite: the trip analytics data mart. It is not a system of
// record and returns aggregates only. Responses are normalised to camelCase.
const { call } = serviceClient('analytics')

export const AnalyticsApi = {
  getInsights: () => call('GET', 'GetInsights'),
  // Wakes the ETL timer and returns the run at once ({ etlRunId, status: 'Running', startedOn });
  // a run already under way is returned instead. Never retried: poll getInsights for the result.
  runEtlNow: () => call('POST', 'RunEtlNow'),
}
