import { alertMessage } from '../insights'
import Banner from '../../../components/Banner'

// Warns when a child is close to, or past, their budget. `who` picks the
// wording: the parent hears about the child, the child hears about themselves.
export default function BudgetAlert({ who, name, spent, budget, period }) {
  const alert = alertMessage({ who, name, spent, budget, period })
  if (!alert) return null
  return <Banner kind={alert.kind}>{alert.text}</Banner>
}
