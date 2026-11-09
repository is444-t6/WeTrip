import { test, expect } from '@playwright/test'
import {
  approvalsSummary,
  declineMessage,
  isPayment,
  exceedsBalance,
  shortfallMessage,
  shortfalls,
} from '../src/features/family/approvals.js'
import { barsLayout, monthLabel, trendLayout } from '../src/features/family/chart.js'

// Pure logic only: no browser, no API.

test.describe('shortfalls', () => {
  const kid = { familyLinkId: 3, nickname: 'Test harness child', balance: 10.61 }
  const req = (amount, familyLinkId = 3) => ({ amount, familyLinkId })

  test('a request above the balance does not fit; one at or below does', () => {
    expect(exceedsBalance(req(9999), kid)).toBe(true)
    expect(exceedsBalance(req(10.62), kid)).toBe(true)
    expect(exceedsBalance(req(10.61), kid)).toBe(false)
    expect(exceedsBalance(req(5), kid)).toBe(false)
    expect(exceedsBalance(req(5), undefined)).toBe(false)
  })

  test('says it once per child, with how many requests are affected', () => {
    const list = shortfalls([req(40), req(120), req(5)], [kid])
    expect(list).toEqual([{ name: 'Test harness child', balance: 10.61, count: 2 }])
    expect(shortfallMessage(list[0])).toBe(
      'Test harness child has SGD 10.61, so 2 requests above that will not go through until you top them up.',
    )
    expect(shortfallMessage({ name: 'Jamie', balance: 250.5, count: 1 })).toBe(
      'Jamie has SGD 250.50, so 1 request above that will not go through until you top them up.',
    )
  })

  test('keeps children apart and ignores requests with no known child', () => {
    const jamie = { familyLinkId: 4, nickname: 'Jamie', balance: 20 }
    const list = shortfalls([req(40, 3), req(30, 4), req(5, 4), req(99, 77)], [kid, jamie])
    expect(list.map((s) => [s.name, s.count])).toEqual([
      ['Test harness child', 1],
      ['Jamie', 1],
    ])
  })

  test('no shortfall when everything fits, or nothing is waiting', () => {
    expect(shortfalls([req(5)], [kid])).toEqual([])
    expect(shortfalls(undefined, [kid])).toEqual([])
    expect(shortfalls([req(5)], undefined)).toEqual([])
  })

  test('falls back to the customer id when there is no nickname', () => {
    const list = shortfalls(
      [req(50)],
      [{ familyLinkId: 3, childCustomerId: '0000003195', balance: 1 }],
    )
    expect(list[0].name).toBe('0000003195')
  })
})

test.describe('approvalsSummary', () => {
  test('counts and totals', () => {
    expect(approvalsSummary([{ amount: 40 }, { amount: '120' }])).toEqual({ count: 2, total: 160 })
    expect(approvalsSummary(undefined)).toEqual({ count: 0, total: 0 })
  })
})

test.describe('trendLayout', () => {
  const points = [
    { yearMonth: '2026-09-01' },
    { yearMonth: '2026-10-01', balance: 569.55 },
    { yearMonth: '2026-11-08', balance: 10.61 },
  ]

  test('month labels come from the year-month', () => {
    expect(monthLabel('2026-10-01')).toBe('Oct')
    expect(monthLabel('2026-11-08')).toBe('Nov')
    expect(monthLabel('nope')).toBe('')
  })

  test('draws only the months that have a balance, but labels every month', () => {
    const t = trendLayout(points)
    expect(t.dots.map((d) => d.label)).toEqual(['Oct', 'Nov'])
    expect(t.labels.map((l) => l.text)).toEqual(['Sep', 'Oct', 'Nov'])
    expect(t.path.startsWith('M')).toBe(true)
    expect(t.path).toContain('L')
    expect(t.area).not.toBe('')
  })

  test('the highest balance sits at the top and the months are evenly spaced', () => {
    const t = trendLayout(points, { width: 320, height: 130, padX: 18, padTop: 14, padBottom: 24 })
    expect(t.dots[0].y).toBe(14)
    expect(t.dots[1].y).toBeGreaterThan(t.dots[0].y)
    expect(t.dots[0].x).toBe(160)
    expect(t.dots[1].x).toBe(302)
  })

  test('a lone balance is a dot without an area; no balances at all is nothing to draw', () => {
    const one = trendLayout([{ yearMonth: '2026-11-01', balance: 50 }])
    expect(one.dots).toHaveLength(1)
    expect(one.area).toBe('')
    expect(trendLayout([{ yearMonth: '2026-11-01' }])).toBeNull()
    expect(trendLayout(undefined)).toBeNull()
  })
})

test.describe('barsLayout', () => {
  const days = [
    { date: '2026-11-01', total: 0 },
    { date: '2026-11-02', total: 40 },
    { date: '2026-11-03', total: 10 },
  ]

  test('scales the tallest bar to the full height and puts the limit line on the same scale', () => {
    const b = barsLayout(days, {
      width: 320,
      height: 120,
      padX: 8,
      padTop: 12,
      padBottom: 22,
      limit: 20,
    })
    expect(b.bars).toHaveLength(3)
    expect(b.bars[0].h).toBe(0)
    expect(b.bars[1].y).toBe(12)
    expect(b.bars[2].h).toBeCloseTo(b.bars[1].h / 4, 5)
    expect(b.limitY).toBeCloseTo(55, 5)
  })

  test('a limit above every bar raises the scale so the line still fits', () => {
    const b = barsLayout(days, {
      width: 320,
      height: 120,
      padX: 8,
      padTop: 12,
      padBottom: 22,
      limit: 80,
    })
    expect(b.limitY).toBe(12)
    expect(b.bars[1].h).toBeCloseTo((40 / 80) * 86, 5)
  })

  test('no limit means no line; no days means nothing to draw', () => {
    expect(barsLayout(days).limitY).toBeNull()
    expect(barsLayout([])).toBeNull()
    expect(barsLayout(undefined)).toBeNull()
  })
})

test.describe('ask-for-more helpers', () => {
  test('a request with a blank merchant is an ask; one with a merchant is a payment', () => {
    expect(isPayment({ merchantAccountId: '0000006718' })).toBe(true)
    expect(isPayment({ merchantAccountId: '', amount: 20 })).toBe(false)
    expect(isPayment({ requestedAmount: 20 })).toBe(false)
    expect(isPayment({ amount: 40 })).toBe(true)
    expect(isPayment({ isPayment: false, merchantAccountId: 'x' })).toBe(false)
  })

  test('asks count by their amount and are never a shortfall', () => {
    const list = [
      { amount: 40, merchantAccountId: 'm' },
      { amount: 25, merchantAccountId: '', familyLinkId: 3 },
    ]
    expect(approvalsSummary(list)).toEqual({ count: 2, total: 65 })
    expect(shortfalls(list, [{ familyLinkId: 3, balance: 1, nickname: 'J' }])).toEqual([])
  })

  test('the decline message prefers the server wording, else says what is left', () => {
    expect(declineMessage({ message: "Over this month's budget by SGD 5.00" })).toBe(
      "Over this month's budget by SGD 5.00",
    )
    expect(declineMessage({ remaining: 150, shortBy: 350 })).toBe(
      'You have SGD 150.00 left this period. This payment is SGD 350.00 over.',
    )
    expect(declineMessage({ remaining: 0 })).toBe('You have nothing left to spend this period.')
  })
})
