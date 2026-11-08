import { test, expect } from '@playwright/test'
import { accountLabel, depositAccounts, lookupMessage } from '../src/features/auth/accounts.js'

// Pure logic only: no browser, no API.

// The shape GetMyAccounts really returns for a demo customer (after the client
// lower-cases the first letter of each key).
const ACCOUNTS = [
  { accountId: '0000004554', productName: 'CASA', currency: 'SGD', balance: 8207.23 },
  { accountId: '0000004847', productName: 'TD 5 Year', currency: 'SGD', balance: 20000 },
  { accountId: '0000006703', currency: 'JPY' },
  { accountId: '0000004555', productName: 'Home Loan', currency: 'SGD', balance: 800000 },
  { accountId: '0000004848', productName: 'CASA', currency: 'SGD', balance: 4699.02 },
]

test.describe('depositAccounts', () => {
  test('keeps open SGD current accounts, in the order given', () => {
    expect(depositAccounts(ACCOUNTS).map((a) => a.accountId)).toEqual(['0000004554', '0000004848'])
  })

  test('a loan, a term deposit and a foreign wallet are never the deposit account', () => {
    const rest = ACCOUNTS.filter((a) => a.productName !== 'CASA')
    expect(depositAccounts(rest)).toEqual([])
  })

  test('a current account in another currency, or a closed one, is skipped', () => {
    expect(
      depositAccounts([
        { accountId: '1', productName: 'CASA', currency: 'USD' },
        { accountId: '2', productName: 'CASA', currency: 'SGD', currentStatus: 'Closed' },
        { accountId: '3', productName: 'CASA', currency: 'SGD', currentStatus: 'Active' },
      ]).map((a) => a.accountId),
    ).toEqual(['3'])
  })

  test('copes with nothing, or something that is not a list', () => {
    expect(depositAccounts([])).toEqual([])
    expect(depositAccounts(undefined)).toEqual([])
    expect(depositAccounts({ Errors: ['x'] })).toEqual([])
    expect(depositAccounts([{ productName: 'CASA', currency: 'SGD' }])).toEqual([])
  })
})

test.describe('labels and messages', () => {
  test('an account reads as number, currency and balance', () => {
    expect(accountLabel(ACCOUNTS[0])).toBe('0000004554 · SGD 8207.23')
    expect(accountLabel({ accountId: '9', currency: 'SGD' })).toBe('9 · SGD 0.00')
  })

  test('an unknown customer gets a plain sentence; other errors pass through', () => {
    expect(lookupMessage(new Error('Customer record not found'))).toBe(
      "We couldn't find a customer with that id.",
    )
    expect(lookupMessage(new Error('Something went wrong (500). Please try again.'))).toBe(
      'Something went wrong (500). Please try again.',
    )
    expect(lookupMessage(undefined)).toBe('Something went wrong. Please try again.')
  })
})
