import { Link, useParams } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../family/components/AppShell'
import Banner from '../family/components/Banner'
import SignedOutCard from '../family/components/SignedOutCard'
import BalanceHero from '../family/components/BalanceHero'
import { DEFAULT_CURRENCY } from './constants'
import { useDashboard } from './queries'
import BudgetBars from './components/BudgetBars'
import ExpenseList from './components/ExpenseList'
import AddExpenseForm from './components/AddExpenseForm'
import SetBudgetForm from './components/SetBudgetForm'

export default function BudgetDetail() {
  const { tripId } = useParams({ from: '/budget/$tripId' })
  const { data, error, isLoading } = useDashboard(tripId)
  const { data: role } = useRole()

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

  return shell(
    <>
      <Link
        to="/budget"
        className="muted"
        style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}
      >
        &larr; Back
      </Link>

      <h1 style={{ fontSize: '1.4rem', marginBottom: 4 }}>Trip {tripId} budget</h1>

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

      <div className="section-title">By category</div>
      <BudgetBars lines={lines} />

      {role === 'Parent' && <SetBudgetForm tripId={tripId} />}
      <AddExpenseForm tripId={tripId} />

      <div className="section-title">Expenses</div>
      <ExpenseList expenses={data.expenses} />
    </>,
  )
}
