import {
  categoryTotals,
  dailyTotals,
  forecast,
  percentChange,
  periodTiming,
  safeDailySpend,
} from '../insights'
import { useChildSpending } from '../useChildSpending'
import Banner from '../../../components/Banner'
import DailySpendChart from './DailySpendChart'
import Money from '../../../components/Money'
import { money } from '../../../lib/format'

const TOP_CATEGORIES = 4

function forecastLine(f, span) {
  switch (f.state) {
    case 'nobudget':
      return { kind: null, text: 'Set a budget to see a spending forecast.' }
    case 'early':
      return { kind: null, text: `Too early in the ${span} to forecast.` }
    case 'on-track':
      return {
        kind: 'ok',
        text: `On track: about ${money(f.projected)} by the end of the ${span}.`,
      }
    case 'over-pace':
      return {
        kind: 'warn',
        text: `At this pace: about ${money(f.projected)} this ${span}, ${money(f.overBy)} over budget. The limit is reached around ${f.runsOutOn.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.`,
      }
    default:
      return {
        kind: 'error',
        text: `Already over budget by ${money(f.overBy)} this ${span}.`,
      }
  }
}

export default function SpendingInsights({ child }) {
  const { span, now, bounds, current, previous } = useChildSpending(child)

  const error = current.error || previous.error
  if (!current.data) {
    return (
      <div className="card">
        <Banner>{error?.message}</Banner>
        {!error && <p className="muted">Loading…</p>}
      </div>
    )
  }

  const spent = Number(current.data.total ?? 0)
  const cats = categoryTotals(current.data.expenses).slice(0, TOP_CATEGORIES)
  const f = forecast({ spent, budget: child.budget, bounds, now })
  const line = forecastLine(f, span)
  const change = previous.data ? percentChange(spent, previous.data.total) : null
  const prevTotal = Number(previous.data?.total ?? 0)

  const remaining = Math.max(0, Number(child.budget ?? 0) - Number(child.spent ?? 0))
  const safe = safeDailySpend(remaining, periodTiming(bounds).daysLeft)
  const days = dailyTotals(current.data.expenses, bounds)

  return (
    <div className="card">
      <Banner>{error?.message}</Banner>
      <div className="row-between">
        <span className="muted">Spent this {span} so far</span>
        <span className="money">
          <Money amount={spent} />
        </span>
      </div>

      {line.kind ? (
        <div className={`banner ${line.kind}`} style={{ marginTop: 12, marginBottom: 0 }}>
          {line.text}
        </div>
      ) : (
        <p className="muted" style={{ marginTop: 10 }}>
          {line.text}
        </p>
      )}

      {spent > 0 && <DailySpendChart days={days} limit={safe} />}

      {cats.length > 0 && (
        <div className="insight-cats">
          {cats.map((c) => (
            <div key={c.category} className="insight-cat">
              <div className="row-between">
                <span>{c.category}</span>
                <span className="muted">
                  <Money amount={c.total} /> · {Math.round(c.share * 100)}%
                </span>
              </div>
              <div className="share-bar">
                <div style={{ width: `${Math.max(2, c.share * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {previous.data && (
        <p className="muted" style={{ marginTop: 12 }}>
          {change === null
            ? `No spending last ${span} to compare with.`
            : change === 0
              ? `Same as last ${span} (${money(prevTotal)}).`
              : `${Math.abs(change)}% ${change > 0 ? 'more' : 'less'} than last ${span} (${money(prevTotal)}).`}
        </p>
      )}
    </div>
  )
}
