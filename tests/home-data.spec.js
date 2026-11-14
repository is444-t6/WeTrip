import { test, expect } from '@playwright/test'
import {
  firstName,
  latestPayments,
  maskAccount,
  totalChildBalance,
  tripCountdown,
} from '../src/features/home/homeData.js'

// Pure logic only: no browser, no API.

test.describe('firstName', () => {
  test('greets by the first word, capitalised', () => {
    expect(firstName('Parent Demo')).toBe('Parent')
    expect(firstName('timothy.loo')).toBe('Timothy')
    expect(firstName('  jamie_lee ')).toBe('Jamie')
    expect(firstName('Mary-Anne')).toBe('Mary')
  })

  test('falls back when there is no name', () => {
    expect(firstName('')).toBe('there')
    expect(firstName(undefined)).toBe('there')
    expect(firstName('   ')).toBe('there')
    expect(firstName(undefined, 'friend')).toBe('friend')
  })
})

test.describe('maskAccount', () => {
  test('keeps only the last four digits', () => {
    expect(maskAccount('0000006385')).toBe('····6385')
  })

  test('leaves a short or missing id alone', () => {
    expect(maskAccount('6385')).toBe('6385')
    expect(maskAccount(undefined)).toBe('')
  })
})

test.describe('tripCountdown', () => {
  // Late in the local day, so a naive UTC comparison would be off by one in Singapore.
  const today = new Date(2026, 10, 14, 23, 30)
  const starting = (tripStartDate) => tripCountdown({ tripStartDate }, today)

  test('counts whole calendar days to the start', () => {
    expect(starting('2026-11-26')).toBe('In 12 days')
    expect(starting('2026-11-16')).toBe('In 2 days')
    expect(starting('2026-11-15')).toBe('Tomorrow')
    expect(starting('2026-11-14')).toBe('Starts today')
    expect(starting('2026-11-10T00:00:00')).toBe('On now')
  })

  test('says nothing for a trip without a start date', () => {
    expect(tripCountdown({}, today)).toBe('')
    expect(tripCountdown(undefined, today)).toBe('')
  })
})

test.describe('latestPayments', () => {
  const pay = (id, dateTime) => ({ id, dateTime })

  test('newest first, limited to the count', () => {
    const rows = latestPayments([
      pay(1, '2026-11-01T10:00:00Z'),
      pay(2, '2026-11-05T10:00:00Z'),
      pay(3, '2026-11-03T10:00:00Z'),
      pay(4, '2026-10-20T10:00:00Z'),
    ])
    expect(rows.map((p) => p.id)).toEqual([2, 3, 1])
    expect(latestPayments([pay(1, '2026-11-01T10:00:00Z')], 3)).toHaveLength(1)
    expect(latestPayments(undefined)).toEqual([])
  })

  test('does not reorder the caller’s array', () => {
    const input = [pay(1, '2026-11-01T10:00:00Z'), pay(2, '2026-11-05T10:00:00Z')]
    latestPayments(input)
    expect(input.map((p) => p.id)).toEqual([1, 2])
  })
})

test.describe('totalChildBalance', () => {
  test('adds up active children only', () => {
    expect(
      totalChildBalance([
        { status: 'Active', balance: 100.5 },
        { status: 'Active', balance: 20 },
        { status: 'Pending', balance: 999 },
      ]),
    ).toBe(120.5)
    expect(totalChildBalance(undefined)).toBe(0)
  })
})
