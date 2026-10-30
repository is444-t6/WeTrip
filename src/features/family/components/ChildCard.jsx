import { Link } from '@tanstack/react-router'
import Money from './Money'

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function badgeClass(status) {
  if (status === 'Active') return 'active'
  if (status === 'Pending') return 'pending'
  return 'removed'
}

export default function ChildCard({ child }) {
  const pct = child.budget ? Math.min(100, (child.spent / child.budget) * 100) : 0
  const label = child.nickname || child.childCustomerId

  return (
    <div className="card">
      <div className="row-between">
        <div className="row">
          <div className="avatar">{initials(label)}</div>
          <div className="stack">
            <strong>{label}</strong>
            <span className="muted">{child.childCustomerId}</span>
          </div>
        </div>
        <span className={`badge ${badgeClass(child.status)}`}>{child.status}</span>
      </div>

      {child.status === 'Active' && (
        <>
          <div className="row-between" style={{ marginTop: 16 }}>
            <span className="muted">Balance</span>
            <span className="money"><Money amount={child.balance} currency={child.hostCurrency} /></span>
          </div>

          {child.budget > 0 ? (
            <>
              <div className={`progress ${pct >= 100 ? 'over' : ''}`}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <div className="row-between muted" style={{ fontSize: '0.82em' }}>
                <span><Money amount={child.spent} /> of <Money amount={child.budget} /> this {child.period?.toLowerCase()}</span>
                {child.hasAllowance && <span className="badge active">allowance</span>}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>No budget set yet</p>
          )}
        </>
      )}

      <Link to="/family/child/$familyLinkId" params={{ familyLinkId: String(child.familyLinkId) }}>
        <button className="secondary" style={{ width: '100%', marginTop: 14 }}>Manage</button>
      </Link>
    </div>
  )
}
