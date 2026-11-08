import { useNavigate } from '@tanstack/react-router'
import Money from './Money'

function initials(name) {
  if (!name) return '?'
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
}

function badgeClass(status) {
  if (status === 'Active') return 'active'
  if (status === 'Pending') return 'pending'
  return 'removed'
}

function periodCopy(period) {
  if (period === 'Weekly') return 'this week'
  if (period === 'Monthly') return 'this month'
  return 'this period'
}

export default function ChildCard({ child }) {
  const navigate = useNavigate()
  const pct = child.budget ? Math.min(100, (child.spent / child.budget) * 100) : 0
  const label = child.nickname || child.childCustomerId

  return (
    <article className="card child-card">
      <div className="row-between">
        <div className="row">
          <div className="avatar">{initials(label)}</div>
          <div className="stack">
            <strong style={{ fontSize: 18 }}>{label}</strong>
            <span className="muted">{child.childCustomerId}</span>
          </div>
        </div>
        <span className={`badge ${badgeClass(child.status)}`}>{child.status}</span>
      </div>

      {child.status === 'Active' && (
        <>
          <div className="child-balance">
            <span className="muted">Balance</span>
            <strong>
              <Money amount={child.balance} />
            </strong>
          </div>

          {child.budget > 0 ? (
            <>
              <div className={`progress ${pct >= 100 ? 'over' : ''}`}>
                <div style={{ width: `${pct}%` }} />
              </div>
              <div className="row-between muted" style={{ fontSize: '0.82em' }}>
                <span>
                  <Money amount={child.spent} /> of <Money amount={child.budget} />{' '}
                  {periodCopy(child.period)}
                </span>
                {child.hasAllowance && <span className="badge active">allowance</span>}
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 12 }}>
              No budget set yet
            </p>
          )}
        </>
      )}

      <button
        className="secondary"
        style={{ width: '100%', marginTop: 18 }}
        onClick={() =>
          navigate({
            to: '/family/child/$familyLinkId',
            params: { familyLinkId: String(child.familyLinkId) },
          })
        }
      >
        Manage
      </button>
    </article>
  )
}
