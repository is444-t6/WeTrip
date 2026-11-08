import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import AppShell from '../family/components/AppShell'
import { clearSession, isLoggedIn } from '../family/session'
import Banner from '../family/components/Banner'
import BalanceHero from '../family/components/BalanceHero'
import { usePageTitle } from '../../lib/usePageTitle'
import { DEFAULT_CURRENCY } from './constants'
import { useDashboard } from './queries'
import BudgetBars from './components/BudgetBars'
import ExpenseList from './components/ExpenseList'
import AddExpenseForm from './components/AddExpenseForm'
import SetBudgetForm from './components/SetBudgetForm'

export default function BudgetDetail() {
  const { tripId } = useParams({ from: '/budget/$tripId' })
  const navigate = useNavigate()
  const { data, error, isLoading } = useDashboard(tripId)
  const { data: role } = useRole()
  usePageTitle(`Trip ${tripId} budget`)

  function signOut() {
    clearSession()
    navigate({ to: '/family' })
  }

  if (error)
    return (
      <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
        <Banner>{error.message}</Banner>
      </AppShell>
    )
  if (isLoading || !data)
    return (
      <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
        <p className="muted">Loading…</p>
      </AppShell>
    )

  const summary = data.summary || {}
  const lines = summary.lines || []
  const alerts = lines.filter((l) => l.alertLevel !== 'OK').length

  return (
    <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
      <div>
        <Link to="/budget" className="back-link">
          &larr; Back
        </Link>

        <h1>Trip {tripId} budget</h1>

        <BalanceHero
          label="Budget remaining"
          amount={Number(summary.totalRemaining) || 0}
          currency={DEFAULT_CURRENCY}
          sub={`${Number(summary.totalSpent || 0).toFixed(2)} spent of ${Number(summary.totalLimit || 0).toFixed(2)}`}
          foot={
            <>
              <span>{lines.length} categories</span>
              {alerts > 0 && <span>{alerts} near or over limit</span>}
            </>
          }
        />

        <h2 className="section-title">By category</h2>
        <BudgetBars lines={lines} />

        {role === 'Parent' && <SetBudgetForm tripId={tripId} />}
        <AddExpenseForm tripId={tripId} />

        <h2 className="section-title">Expenses</h2>
        <ExpenseList expenses={data.expenses} />
      </div>
    </AppShell>
  )
}
