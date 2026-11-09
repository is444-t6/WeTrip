import { test, expect } from '@playwright/test'
import {
  firstName,
  latestPayments,
  maskAccount,
  totalChildBalance,
  tripWallets,
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

test.describe('tripWallets', () => {
  const trip = (over) => ({
    tripId: 1,
    destination: 'Kyoto',
    currency: 'JPY',
    status: 'Locked',
    tripStartDate: '2027-04-01',
    lockedForeign: 96675.38,
    ...over,
  })

  test('one entry per funded trip, soonest first', () => {
    const wallets = tripWallets([
      trip({
        tripId: 2,
        destination: 'Seoul',
        currency: 'KRW',
        tripStartDate: '2027-08-01',
        lockedForeign: 500000,
      }),
      trip({ tripId: 1 }),
    ])
    expect(wallets).toEqual([
      { tripId: 1, destination: 'Kyoto', currency: 'JPY', amount: 96675.38 },
      { tripId: 2, destination: 'Seoul', currency: 'KRW', amount: 500000 },
    ])
  })

  test('skips finished trips and trips with nothing locked', () => {
    expect(
      tripWallets([
        trip({ tripId: 1, status: 'Completed' }),
        trip({ tripId: 2, status: 'Cancelled' }),
        trip({ tripId: 3, lockedForeign: 0 }),
        trip({ tripId: 4, lockedForeign: undefined }),
      ]),
    ).toEqual([])
    expect(tripWallets(undefined)).toEqual([])
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
