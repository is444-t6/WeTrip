import { useState } from 'react'
import { useChildExpenses } from './queries'
import { periodBounds, previousPeriod, ymd } from './insights'

// A child's expenses for the budget period so far and for the period before it.
// Several components ask for this at once; the dates are the query keys, so
// they share one request each.
export function useChildSpending(child) {
  const period = child.period === 'Weekly' ? 'Weekly' : 'Monthly'
  // One clock reading per mount keeps the query keys stable between renders.
  const [now] = useState(() => new Date())
  const bounds = periodBounds(period, now)
  const prev = previousPeriod(period, bounds)
  const familyLinkId = Number(child.familyLinkId)

  return {
    period,
    span: period === 'Weekly' ? 'week' : 'month',
    now,
    bounds,
    current: useChildExpenses(familyLinkId, ymd(bounds.start), ymd(now)),
    previous: useChildExpenses(familyLinkId, ymd(prev.start), ymd(prev.end)),
  }
}
