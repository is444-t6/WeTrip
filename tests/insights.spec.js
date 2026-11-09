import { test, expect } from '@playwright/test'
import {
  alertMessage,
  budgetHealth,
  budgetStatus,
  categoryTotals,
  dailyTotals,
  forecast,
  payNotice,
  percentChange,
  periodBounds,
  periodTiming,
  previousPeriod,
  safeDailySpend,
  ymd,
} from '../src/features/family/insights.js'

// Pure logic only: no browser, no API. Dates are built from local parts so the
// result does not depend on the machine's timezone.
const day = (m, d, y = 2026) => new Date(y, m - 1, d, 12)

test.describe('budgetStatus', () => {
  test('classifies spending against the budget', () => {
    expect(budgetStatus(50, 200)).toMatchObject({ level: 'ok', pct: 25, remaining: 150 })
    expect(budgetStatus(160, 200)).toMatchObject({ level: 'near', pct: 80 })
    expect(budgetStatus(199, 200).level).toBe('near')
    expect(budgetStatus(200, 200)).toMatchObject({ level: 'over', remaining: 0 })
    expect(budgetStatus(250, 200)).toMatchObject({ level: 'over', pct: 125, remaining: 0 })
  })

  test('no budget set means nothing to compare', () => {
    expect(budgetStatus(500, 0).level).toBe('none')
    expect(budgetStatus(500, undefined).level).toBe('none')
  })
})

test.describe('alertMessage', () => {
  const base = { name: 'Jamie', budget: 200, period: 'Weekly' }

  test('says nothing while spending is comfortable or there is no budget', () => {
    expect(alertMessage({ ...base, who: 'parent', spent: 50 })).toBeNull()
    expect(alertMessage({ ...base, who: 'child', spent: 50 })).toBeNull()
    expect(alertMessage({ ...base, who: 'parent', spent: 99, budget: 0 })).toBeNull()
  })

  test('parent: near, over, and exactly used up', () => {
    expect(alertMessage({ ...base, who: 'parent', spent: 170 })).toEqual({
      kind: 'warn',
      text: 'Jamie has used 85% of their weekly budget (SGD 170.00 of SGD 200.00).',
    })
    expect(alertMessage({ ...base, who: 'parent', spent: 210 })).toEqual({
      kind: 'error',
      text: 'Jamie is over their weekly budget by SGD 10.00. New payments will be declined unless you raise their limit.',
    })
    expect(alertMessage({ ...base, who: 'parent', spent: 200 })).toEqual({
      kind: 'error',
      text: 'Jamie has used all of their weekly budget. New payments will be declined unless you raise their limit.',
    })
  })

  test('child: how much is left, then that approval is needed', () => {
    expect(alertMessage({ ...base, who: 'child', spent: 170 })).toEqual({
      kind: 'warn',
      text: "You've used 85% of this week's budget. SGD 30.00 left.",
    })
    expect(alertMessage({ ...base, who: 'child', spent: 200 })).toEqual({
      kind: 'error',
      text: "You've reached this week's budget. New payments will be declined unless your parent raises your limit.",
    })
  })

  test('uses monthly wording for a monthly budget', () => {
    expect(alertMessage({ ...base, who: 'child', spent: 170, period: 'Monthly' }).text).toContain(
      "this month's budget",
    )
  })
})

test.describe('periods', () => {
  test('month: first to last day, days elapsed counted inclusively', () => {
    const b = periodBounds('Monthly', day(11, 8))
    expect(ymd(b.start)).toBe('2026-11-01')
    expect(ymd(b.end)).toBe('2026-11-30')
    expect(b).toMatchObject({ length: 30, elapsed: 8 })
    expect(periodBounds('Monthly', day(2, 15)).length).toBe(28)
  })

  test('week: Monday to Sunday, and Sunday is the seventh day', () => {
    const sunday = periodBounds('Weekly', day(11, 8))
    expect(ymd(sunday.start)).toBe('2026-11-02')
    expect(ymd(sunday.end)).toBe('2026-11-08')
    expect(sunday).toMatchObject({ length: 7, elapsed: 7 })
    const monday = periodBounds('Weekly', day(11, 2))
    expect(monday.elapsed).toBe(1)
  })

  test('previous period is the one directly before', () => {
    const month = previousPeriod('Monthly', periodBounds('Monthly', day(11, 8)))
    expect([ymd(month.start), ymd(month.end)]).toEqual(['2026-10-01', '2026-10-31'])
    const jan = previousPeriod('Monthly', periodBounds('Monthly', day(1, 10)))
    expect([ymd(jan.start), ymd(jan.end)]).toEqual(['2025-12-01', '2025-12-31'])
    const week = previousPeriod('Weekly', periodBounds('Weekly', day(11, 8)))
    expect([ymd(week.start), ymd(week.end)]).toEqual(['2026-10-26', '2026-11-01'])
  })

  test('ymd keeps the local date', () => {
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(ymd(new Date(2026, 10, 7, 0, 30))).toBe('2026-11-07')
  })
})

test.describe('forecast', () => {
  const now = day(11, 8)
  const bounds = periodBounds('Monthly', now) // 8 of 30 days

  test('no budget, no forecast', () => {
    expect(forecast({ spent: 100, budget: 0, bounds, now }).state).toBe('nobudget')
  })

  test('on track when the pace stays inside the budget', () => {
    expect(forecast({ spent: 80, budget: 500, bounds, now })).toEqual({
      state: 'on-track',
      projected: 300,
    })
    expect(forecast({ spent: 0, budget: 500, bounds, now }).projected).toBe(0)
  })

  test('over pace names the overshoot and when the budget runs out', () => {
    const f = forecast({ spent: 200, budget: 500, bounds, now })
    expect(f.state).toBe('over-pace')
    expect(f.projected).toBe(750)
    expect(f.overBy).toBe(250)
    // 25 a day, 300 left: twelve more days from the 8th.
    expect(ymd(f.runsOutOn)).toBe('2026-11-20')
  })

  test('already over budget skips the projection', () => {
    expect(forecast({ spent: 600, budget: 500, bounds, now })).toEqual({
      state: 'over',
      overBy: 100,
    })
  })

  test('the first days of a period are too early to project', () => {
    const early = day(11, 2)
    expect(
      forecast({ spent: 10, budget: 500, bounds: periodBounds('Monthly', early), now: early }),
    ).toEqual({
      state: 'early',
    })
    // A week needs two days of data, not three.
    const tuesday = day(11, 3)
    expect(
      forecast({ spent: 10, budget: 500, bounds: periodBounds('Weekly', tuesday), now: tuesday })
        .state,
    ).toBe('on-track')
  })
})

test.describe('categories and change', () => {
  test('groups, sorts and shares by category; blank becomes Other', () => {
    const rows = categoryTotals([
      { category: 'Food', amount: 30 },
      { category: 'Food', amount: 10 },
      { category: ' ', amount: 10 },
      { category: 'Study', amount: 50 },
    ])
    expect(rows.map((r) => r.category)).toEqual(['Study', 'Food', 'Other'])
    expect(rows.map((r) => r.total)).toEqual([50, 40, 10])
    expect(rows.map((r) => r.share)).toEqual([0.5, 0.4, 0.1])
    expect(categoryTotals(undefined)).toEqual([])
  })

  test('percent change is null with nothing to compare against', () => {
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(100, 100)).toBe(0)
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(10, undefined)).toBeNull()
  })
})

test.describe('time left in the period', () => {
  test('days left count today; pace is how far through the period we are', () => {
    const month = periodTiming(periodBounds('Monthly', day(11, 8)))
    expect(month.daysLeft).toBe(23)
    expect(month.elapsedPct).toBeCloseTo(26.67, 2)
    const week = periodTiming(periodBounds('Weekly', day(11, 4)))
    expect(week.daysLeft).toBe(5)
    expect(week.elapsedPct).toBeCloseTo(42.86, 2)
    // The last day still has one day left (today).
    expect(periodTiming(periodBounds('Weekly', day(11, 8))).daysLeft).toBe(1)
  })

  test('safe daily spend spreads what is left over the days left', () => {
    expect(safeDailySpend(300, 23)).toBeCloseTo(13.04, 2)
    expect(safeDailySpend(0, 5)).toBe(0)
    expect(safeDailySpend(-20, 5)).toBe(0)
    expect(safeDailySpend(100, 0)).toBe(0)
  })
})

test.describe('dailyTotals', () => {
  test('one entry per day so far, quiet days as zero, other months ignored', () => {
    const bounds = periodBounds('Monthly', day(11, 4))
    const days = dailyTotals(
      [
        { date: '2026-11-02T10:00:00Z', amount: 30 },
        { date: '2026-11-02', amount: 10 },
        { date: '2026-11-04', amount: 5 },
        { date: '2026-10-30', amount: 99 },
      ],
      bounds,
    )
    expect(days).toEqual([
      { date: '2026-11-01', total: 0 },
      { date: '2026-11-02', total: 40 },
      { date: '2026-11-03', total: 0 },
      { date: '2026-11-04', total: 5 },
    ])
    expect(dailyTotals(undefined, bounds)).toHaveLength(4)
  })
})

test.describe('budgetHealth', () => {
  const month = periodBounds('Monthly', day(11, 8)) // 8 of 30 days
  const health = (spent, budget, bounds = month) => budgetHealth({ spent, budget, bounds }).state

  test('on track, spending fast, over, or no budget', () => {
    expect(health(80, 500)).toBe('ok')
    expect(health(250, 500)).toBe('watch')
    expect(health(500, 500)).toBe('over')
    expect(health(900, 500)).toBe('over')
    expect(health(50, 0)).toBe('none')
  })

  test('stays quiet in the first days of a period', () => {
    const early = periodBounds('Monthly', day(11, 2))
    expect(health(400, 500, early)).toBe('ok')
    const tuesday = periodBounds('Weekly', day(11, 4))
    expect(health(150, 200, tuesday)).toBe('watch')
  })

  test('gives a label to show', () => {
    expect(budgetHealth({ spent: 250, budget: 500, bounds: month }).label).toBe('Spending fast')
    expect(budgetHealth({ spent: 10, budget: 500, bounds: month }).label).toBe('On track')
  })
})

test.describe('payNotice', () => {
  const base = { balance: 250.5, remaining: 150, hasBudget: true }

  test('nothing to say for a payment that fits', () => {
    expect(payNotice({ ...base, amount: 40 })).toBeNull()
    expect(payNotice({ ...base, amount: 150 })).toBeNull()
    expect(payNotice({ ...base, amount: '' })).toBeNull()
    expect(payNotice({ ...base, amount: 0 })).toBeNull()
  })

  test('warns when it is over the budget, and says by how much', () => {
    expect(payNotice({ ...base, amount: 200 })).toEqual({
      kind: 'warn',
      text: 'That is SGD 50.00 over what is left in your budget, so it will be declined unless your parent raises your limit.',
    })
  })

  test('more than the balance is an error and wins over the budget warning', () => {
    expect(payNotice({ ...base, amount: 300 })).toEqual({
      kind: 'error',
      text: 'That is more than your balance (SGD 250.50).',
    })
  })

  test('without a budget only the balance matters', () => {
    expect(payNotice({ balance: 20, remaining: 0, hasBudget: false, amount: 15 })).toBeNull()
    expect(payNotice({ balance: 20, remaining: 0, hasBudget: false, amount: 25 }).kind).toBe(
      'error',
    )
  })
})
