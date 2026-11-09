import { createClient } from '../../lib/http'

const { call, qs } = createClient({
  base: import.meta.env.VITE_BUDGET_API_BASE || '/api/budget',
  apiKey: import.meta.env.VITE_BUDGET_API_KEY || import.meta.env.VITE_FAMILY_API_KEY,
  normalize: true, // responses arrive camelCase; request bodies stay PascalCase
})

// Request keys are the structure attribute names (PascalCase), because the
// BudgetComposite structures use OutSystems' default JSON names.
export const BudgetApi = {
  getDashboard: (tripId) => call('GET', `GetDashboard${qs({ TripId: tripId })}`),
  recordSpending: (spending) => call('POST', 'RecordSpending', spending),
  setBudget: (budget) => call('POST', 'SetBudget', budget),
  importBank: (payload) => call('POST', 'ImportBank', payload),
}
