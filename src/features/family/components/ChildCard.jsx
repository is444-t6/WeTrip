import { useNavigate } from '@tanstack/react-router'
import { budgetStatus, periodBounds, periodTiming } from '../insights'
import Avatar from './Avatar'
import PaceBar from './PaceBar'
import Money from '../../../components/Money'
import NextTripLine from './NextTripLine'
import { maskAccount } from '../../home/homeData'

function badgeClass(status) {
  if (status === 'Active') return 'active'
  if (status === 'Pending') return 'pending'
  return 'removed'
}

export default function ChildCard({ child }) {
  const navigate = useNavigate()
  const bounds = periodBounds(child.period === 'Weekly' ? 'Weekly' : 'Monthly')
  const { daysLeft } = periodTiming(bounds)
  const label = child.nickname || child.childCustomerId
  const { level } = budgetStatus(child.spent, child.budget)

  return (
    <div className="card">
      <div className="row-between">
        <div className="row">
          <Avatar name={label} />
          <div className="stack">
            <strong>{label}</strong>
            <span className="muted">Customer {maskAccount(child.childCustomerId)}</span>
          </div>
        </div>
        <span className={`badge ${badgeClass(child.status)}`}>{child.status}</span>
      </div>

      {child.status === 'Active' && (
        <>
          <div className="row-between" style={{ marginTop: 16 }}>
            <span className="muted">Balance</span>
            <span className="money">
              <Money amount={child.balance} />
            </span>
          </div>

          {child.budget > 0 ? (
            <>
              <PaceBar spent={child.spent} budget={child.budget} bounds={bounds} />
              <div className="row-between muted" style={{ fontSize: '0.82em' }}>
                <span>
                  <Money amount={child.spent} /> of <Money amount={child.budget} /> · {daysLeft}{' '}
                  {daysLeft === 1 ? 'day' : 'days'} left
                </span>
                <span className="row">
                  {level === 'near' && <span className="badge pending">80%+ used</span>}
                  {level === 'over' && <span className="badge removed">over budget</span>}
                  {child.hasAllowance && <span className="badge active">allowance</span>}
                </span>
              </div>
            </>
          ) : (
            <p className="muted" style={{ marginTop: 10 }}>
              No budget set yet
            </p>
          )}
          <NextTripLine trip={child.nextTrip} />
        </>
      )}

      <button
        type="button"
        className="secondary"
        style={{ width: '100%', marginTop: 14 }}
        onClick={() =>
          navigate({
            to: '/family/child/$familyLinkId',
            params: { familyLinkId: String(child.familyLinkId) },
          })
        }
      >
        Manage
      </button>
    </div>
  )
}
