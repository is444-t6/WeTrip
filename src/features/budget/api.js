import { serviceClient } from '../../lib/services'

// Responses arrive camelCase; request bodies stay PascalCase (the structures use OutSystems' default JSON names).
const { call, qs } = serviceClient('budget')

// Request keys are the structure attribute names (PascalCase), because the
// BudgetComposite structures use OutSystems' default JSON names.
export const BudgetApi = {
  getDashboard: (tripId) => call('GET', `GetDashboard${qs({ TripId: tripId })}`),
  recordSpending: (spending) => call('POST', 'RecordSpending', spending),
  setBudget: (budget) => call('POST', 'SetBudget', budget),
}
