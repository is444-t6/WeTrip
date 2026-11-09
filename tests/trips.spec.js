import { test, expect } from '@playwright/test'
import {
  daysUntil,
  foreignLeft,
  lockMessage,
  lockSummary,
  nextTrip,
  parseDay,
  statusBadge,
  tripTiming,
} from '../src/features/family/trips.js'

// Pure logic only: no browser, no API. Dates are built from local parts so the
// result does not depend on the machine's timezone.
const NOW = new Date(2026, 10, 8, 12) // 8 Nov 2026

const trip = (over = {}) => ({
  tripId: 12,
  destination: 'Kyoto',
  currency: 'JPY',
  tripStartDate: '2027-04-01',
  tripEndDate: '2027-04-14',
  status: 'PartiallyLocked',
  targetBudgetSgd: 800,
  lockedSgd: 800,
  lockedForeign: 96675.38,
  ...over,
})

test.describe('dates and timing', () => {
  test('parseDay reads the calendar date, ignoring any time part', () => {
    expect(parseDay('2027-04-01')).toEqual(new Date(2027, 3, 1))
    expect(parseDay('2027-04-01T23:30:00Z')).toEqual(new Date(2027, 3, 1))
    expect(parseDay('')).toBeNull()
    expect(parseDay(undefined)).toBeNull()
  })

  test('daysUntil counts whole days and goes negative once passed', () => {
    expect(daysUntil('2027-04-01', NOW)).toBe(144)
    expect(daysUntil('2026-11-08', NOW)).toBe(0)
    expect(daysUntil('2026-11-07', NOW)).toBe(-1)
    expect(daysUntil('nope', NOW)).toBeNull()
  })

  test('tripTiming says where the trip is in time', () => {
    const at = (start, end) => tripTiming(trip({ tripStartDate: start, tripEndDate: end }), NOW)
    expect(at('2027-04-01', '2027-04-14')).toBe('in 144 days')
    expect(at('2026-11-10', '2026-11-20')).toBe('in 2 days')
    expect(at('2026-11-09', '2026-11-20')).toBe('tomorrow')
    expect(at('2026-11-08', '2026-11-20')).toBe('starts today')
    expect(at('2026-11-01', '2026-11-20')).toBe('underway, 12 days left')
    expect(at('2026-11-01', '2026-11-09')).toBe('underway, 1 day left')
    expect(at('2026-11-01', '2026-11-08')).toBe('last day today')
    expect(at('2026-10-01', '2026-10-14')).toBe('ended')
    expect(tripTiming({}, NOW)).toBe('')
  })
})

test.describe('nextTrip', () => {
  test('picks the earliest trip that is still ahead or under way', () => {
    const later = trip({
      tripId: 2,
      destination: 'Seoul',
      tripStartDate: '2027-08-01',
      tripEndDate: '2027-08-10',
    })
    const sooner = trip({
      tripId: 3,
      destination: 'Osaka',
      tripStartDate: '2026-12-20',
      tripEndDate: '2026-12-30',
    })
    expect(nextTrip([later, trip(), sooner], NOW).destination).toBe('Osaka')
  })

  test('skips cancelled, completed and finished trips', () => {
    const trips = [
      trip({ tripId: 1, status: 'Cancelled' }),
      trip({ tripId: 2, status: 'Completed' }),
      trip({ tripId: 3, tripStartDate: '2026-09-01', tripEndDate: '2026-09-10' }),
    ]
    expect(nextTrip(trips, NOW)).toBeNull()
    expect(nextTrip([], NOW)).toBeNull()
    expect(nextTrip(undefined, NOW)).toBeNull()
  })

  test('keeps a trip that is under way', () => {
    const now = trip({ tripStartDate: '2026-11-01', tripEndDate: '2026-11-20' })
    expect(nextTrip([now], NOW)).toBe(now)
  })

  test('badge colours follow the SmartFX screen', () => {
    expect(statusBadge('Watching')).toBe('pending')
    expect(statusBadge('Locked')).toBe('active')
    expect(statusBadge('Cancelled')).toBe('removed')
    expect(statusBadge('Completed')).toBe('removed')
  })
})

test.describe('locked rate versus today', () => {
  test('locking earlier cost more than buying today', () => {
    const s = lockSummary(trip(), 121.0494)
    expect(s.state).toBe('costlier')
    expect(s.avgRate.toFixed(4)).toBe('120.8442')
    expect(s.todaySgd.toFixed(2)).toBe('798.64')
    expect(s.diffSgd.toFixed(2)).toBe('1.36')
    expect(lockMessage(s, { currency: 'JPY', period: '6M' })).toBe(
      "Locked JPY 96675.38 for SGD 800.00 (average rate 120.8442). At today's 6M forward of 121.0494 that would cost SGD 798.64, so locking early cost SGD 1.36 more.",
    )
  })

  test('locking earlier saved money when the rate has moved against the buyer', () => {
    const s = lockSummary(trip(), 119)
    expect(s.state).toBe('cheaper')
    expect(lockMessage(s, { currency: 'JPY', period: '6M' })).toContain(
      'would cost SGD 812.40, so locking early saved SGD 12.40.',
    )
  })

  test('the same rate is reported as about the same', () => {
    const s = lockSummary(trip(), 96675.38 / 800)
    expect(s.state).toBe('same')
    expect(lockMessage(s, { currency: 'JPY', period: '6M' })).toContain('about the same.')
  })

  test('nothing locked, or no rate to compare with', () => {
    expect(lockSummary(trip({ lockedSgd: 0, lockedForeign: 0 }), 121).state).toBe('none')
    expect(lockMessage({ state: 'none' }, { currency: 'JPY', period: '6M' })).toBe(
      'Nothing locked yet.',
    )
    const s = lockSummary(trip(), undefined)
    expect(s.state).toBe('norate')
    expect(lockMessage(s, { currency: 'JPY', period: '6M' })).toContain(
      "Today's rate is not available.",
    )
  })
})

test.describe('foreignLeft', () => {
  test('locked money less what has been spent', () => {
    const f = foreignLeft(trip(), [{ amount: 15000 }, { amount: '5000' }])
    expect(f.spent).toBe(20000)
    expect(f.left).toBeCloseTo(76675.38, 2)
    expect(f.pct).toBeCloseTo(20.69, 2)
  })

  test('no spending yet, nothing locked, and overspending never goes negative', () => {
    expect(foreignLeft(trip(), undefined)).toMatchObject({ spent: 0, pct: 0 })
    expect(foreignLeft(trip({ lockedForeign: 0 }), [])).toMatchObject({ left: 0, pct: 0 })
    expect(foreignLeft(trip({ lockedForeign: 100 }), [{ amount: 150 }])).toMatchObject({
      left: 0,
      pct: 100,
    })
  })
})
