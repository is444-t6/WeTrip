import { Link, useParams } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'
import BalanceHero from '../../components/BalanceHero'
import { isEnded } from '../fx/status'
import { DEFAULT_CURRENCY, SOURCE } from './constants'
import { useTrip } from '../fx/queries'
import { useDashboard } from './queries'
import BudgetBars from './components/BudgetBars'
import ExpenseList from './components/ExpenseList'
import AddExpenseForm from './components/AddExpenseForm'
import SetBudgetForm from './components/SetBudgetForm'
import AddFixedCostForm from './components/AddFixedCostForm'

export default function BudgetDetail() {
  const { tripId } = useParams({ from: '/budget/$tripId' })
  const { data, error, isLoading } = useDashboard(tripId)
  // The destination only names the page; a SmartFX outage must not hide the budget.
  const trip = useTrip(tripId).data?.trip
  const destination = trip?.destination
  const { role } = useCurrentUser()

  function signOut() {
    clearSession()
    window.location.reload()
  }

  // Every state of the page sits inside the app shell, so the navbar and the
  // side gutter are always there, including while loading or after an error.
  const shell = (content) => <AppShell onSignOut={signOut}>{content}</AppShell>

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip Budget" />
  if (error) return shell(<Banner>{error.message}</Banner>)
  if (isLoading || !data) return shell(<p className="muted">Loading…</p>)

  const summary = data.summary || {}
  const lines = summary.lines || []
  const alerts = lines.filter((l) => l.alertLevel !== 'OK').length
  // Fixed costs are ordinary expenses (SourceId 5), so they are already inside
  // totalSpent and the category lines; this only splits the total for display.
  const fixed = (data.expenses || [])
    .filter((e) => Number(e.sourceId) === SOURCE.FIXED)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  return shell(
    <>
      <Link to="/budget" className="back-link">
        &larr; Back
      </Link>

      <h1>{destination || `Trip ${tripId}`} budget</h1>

      <BalanceHero
        label="Budget remaining"
        amount={Number(summary.totalRemaining) || 0}
        currency={DEFAULT_CURRENCY}
        sub={`${Number(summary.totalSpent || 0).toFixed(2)} spent of ${Number(summary.totalLimit || 0).toFixed(2)}`}
        foot={
          <>
            <span>{lines.length} categories</span>
            {alerts > 0 && <span>{alerts} near or over limit</span>}
            {fixed > 0 && (
              <>
                <span>
                  Fixed {DEFAULT_CURRENCY} {fixed.toFixed(2)}
                </span>
                <span>
                  Day-to-day {DEFAULT_CURRENCY}{' '}
                  {((Number(summary.totalSpent) || 0) - fixed).toFixed(2)}
                </span>
              </>
            )}
          </>
        }
      />

      <h2 className="section-title">By category</h2>
      <BudgetBars lines={lines} />

      {role === 'Parent' && <SetBudgetForm tripId={tripId} />}
      {role === 'Parent' && !isEnded(trip?.status) && <AddFixedCostForm tripId={tripId} />}
      <AddExpenseForm tripId={tripId} />

      <h2 className="section-title">Expenses</h2>
      <ExpenseList expenses={data.expenses} />
    </>,
  )
}
