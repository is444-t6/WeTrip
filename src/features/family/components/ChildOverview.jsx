import { budgetHealth, percentChange, periodTiming, safeDailySpend } from '../insights'
import { useChildSpending } from '../useChildSpending'
import Avatar from './Avatar'
import Money from '../../../components/Money'
import PaceBar from './PaceBar'

const HEALTH_BADGE = { ok: 'active', watch: 'pending', over: 'removed', none: 'pending' }

// The top of a child's page: who, how much they have, and how the budget is
// going, before any form or table.
export default function ChildOverview({ child, onSetBudget }) {
  const { span, now, bounds, current, previous } = useChildSpending(child)
  const label = child.nickname || child.childCustomerId
  const budget = Number(child.budget ?? 0)
  const spent = Number(child.spent ?? 0)
  const remaining = Math.max(0, budget - spent)
  const timing = periodTiming(bounds)
  const health = budgetHealth({ spent, budget, bounds, now })
  const safe = safeDailySpend(remaining, timing.daysLeft)
  const change =
    current.data && previous.data ? percentChange(current.data.total, previous.data.total) : null

  return (
    <div className="card overview">
      <div className="row-between">
        <div className="row">
          <Avatar name={label} />
          <div className="stack">
            <strong>{label}</strong>
            <span className="muted">{child.childCustomerId}</span>
          </div>
        </div>
        <div className="stack overview-balance">
          <span className="muted">Balance</span>
          <span className="money">
            <Money amount={child.balance} />
          </span>
        </div>
      </div>

      {budget > 0 ? (
        <>
          <div className="row-between" style={{ marginTop: 16 }}>
            <span className={`badge ${HEALTH_BADGE[health.state]}`}>{health.label}</span>
            <span className="muted">
              {timing.daysLeft} {timing.daysLeft === 1 ? 'day' : 'days'} left this {span}
            </span>
          </div>
          <PaceBar spent={spent} budget={budget} bounds={bounds} />
          <div className="row-between muted" style={{ fontSize: '0.84em' }}>
            <span>
              <Money amount={spent} /> of <Money amount={budget} />
            </span>
            <span>Tick = an even pace</span>
          </div>
          <div className="tiles">
            <div className="tile">
              <span className="muted">Left to spend</span>
              <span className="money">
                <Money amount={remaining} />
              </span>
            </div>
            <div className="tile">
              <span className="muted">Safe per day</span>
              <span className="money">{safe > 0 ? <Money amount={safe} /> : '—'}</span>
            </div>
            <div className="tile">
              <span className="muted">vs last {span}</span>
              <span className="money">
                {change === null ? '—' : `${change > 0 ? '+' : ''}${change}%`}
              </span>
            </div>
          </div>
        </>
      ) : (
        <div className="overview-empty">
          <span className="muted">No budget set yet, so there is no pace to show.</span>
          <button type="button" className="secondary" onClick={onSetBudget}>
            Set a budget
          </button>
        </div>
      )}
    </div>
  )
}
