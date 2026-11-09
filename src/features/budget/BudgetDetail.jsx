import { Link, useParams } from '@tanstack/react-router'
import { useRole } from '../family/queries'
import Banner from '../family/components/Banner'
import BalanceHero from '../family/components/BalanceHero'
import { DEFAULT_CURRENCY } from './constants'
import { useDashboard } from './queries'
import BudgetBars from './components/BudgetBars'
import ExpenseList from './components/ExpenseList'
import AddExpenseForm from './components/AddExpenseForm'
import SetBudgetForm from './components/SetBudgetForm'
import BudgetShell from './BudgetShell'

export default function BudgetDetail() {
  const { tripId } = useParams({ from: '/budget/$tripId' })
  const { data, error, isLoading } = useDashboard(tripId)
  const { data: role } = useRole()

  if (error)
    return (
      <BudgetShell>
        <Banner>{error.message}</Banner>
      </BudgetShell>
    )
  if (isLoading || !data)
    return (
      <BudgetShell>
        <p className="muted">Loading…</p>
      </BudgetShell>
    )


  const summary = data.summary || {}
  const lines = summary.lines || []
  const alerts = lines.filter((l) => l.alertLevel !== 'OK').length

  return (
    <BudgetShell>
      <Link to="/budget" className="muted" style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}>
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
    </BudgetShell>
  )
}
