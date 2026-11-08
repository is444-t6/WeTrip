import { Link } from '@tanstack/react-router'
import { useChildDashboard, useChildren } from '../../family/queries'
import { budgetStatus } from '../../family/insights'
import Money from '../../family/components/Money'
import { totalChildBalance } from '../homeData'

function ParentFamily({ pendingApprovals }) {
  const { data: children, isLoading } = useChildren()
  const active = (children ?? []).filter((c) => c.status === 'Active')

  return (
    <div className="card">
      <div className="card-header">
        <h3>Family</h3>
        {pendingApprovals > 0 && (
          <span className="badge pending">{pendingApprovals} to approve</span>
        )}
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {children && active.length === 0 && (
        <p className="muted">No children linked yet. Add one from the Family page.</p>
      )}
      {active.slice(0, 3).map((c) => {
        const { level } = budgetStatus(c.spent, c.budget)
        return (
          <div key={c.familyLinkId} className="row-between home-row">
            <div className="stack">
              <strong>{c.nickname || c.childCustomerId}</strong>
              <span className="muted">
                {level === 'over' && 'Over budget'}
                {level === 'near' && '80%+ of budget used'}
                {(level === 'ok' || level === 'none') &&
                  (c.budget > 0 ? 'Within budget' : 'No budget set')}
              </span>
            </div>
            <span className="money">
              <Money amount={c.balance} />
            </span>
          </div>
        )
      })}
      {active.length > 0 && (
        <div className="row-between muted home-row">
          <span>
            {active.length} {active.length === 1 ? 'child' : 'children'} linked
          </span>
          <span>
            Total <Money amount={totalChildBalance(children)} />
          </span>
        </div>
      )}
      <Link to="/family">
        <button className="secondary" style={{ width: '100%', marginTop: 12 }}>
          Manage family
        </button>
      </Link>
    </div>
  )
}

function ChildFamily() {
  const { data: dash, isLoading } = useChildDashboard()
  const pct = dash?.budget ? Math.min(100, (dash.spent / dash.budget) * 100) : 0

  return (
    <div className="card">
      <div className="card-header">
        <h3>My budget</h3>
        {pct >= 100 && <span className="badge removed">over</span>}
      </div>
      {isLoading && <p className="muted">Loading…</p>}
      {dash && !dash.hasBudget && <p className="muted">Your parent hasn't set a budget yet.</p>}
      {dash?.hasBudget && (
        <>
          <div className="row-between">
            <span className="money">
              <Money amount={dash.remaining} />
            </span>
            <span className="muted">
              left this{' '}
              {dash.period === 'Weekly' ? 'week' : dash.period === 'Monthly' ? 'month' : 'period'}
            </span>
          </div>
          <div className={`progress ${pct >= 100 ? 'over' : ''}`}>
            <div style={{ width: `${pct}%` }} />
          </div>
          <p className="muted">
            <Money amount={dash.spent} /> of <Money amount={dash.budget} /> spent
          </p>
        </>
      )}
      <Link to="/family">
        <button className="secondary" style={{ width: '100%', marginTop: 12 }}>
          Open my wallet
        </button>
      </Link>
    </div>
  )
}

export default function FamilyOverview({ role, pendingApprovals }) {
  if (role === 'Parent') return <ParentFamily pendingApprovals={pendingApprovals} />
  if (role === 'Child') return <ChildFamily />
  if (role === 'Pending' || role === 'None') {
    return (
      <div className="card">
        <h3>Family</h3>
        <p className="muted">
          Parents can link a child to manage their budget and allowance. Children can accept an
          invite from a parent.
        </p>
        <Link to="/family">
          <button className="secondary" style={{ width: '100%', marginTop: 12 }}>
            Set up family
          </button>
        </Link>
      </div>
    )
  }
  return null
}
