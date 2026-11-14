import { test, expect } from '@playwright/test'
import { day, dayRange, money, rate, rateText } from '../src/lib/format.js'

// Pure logic only: no browser, no API.

test.describe('money', () => {
  test('groups digits, keeps two decimals and uses a plain space', () => {
    expect(money(1000)).toBe('SGD 1,000.00')
    expect(money(96675.38, 'JPY')).toBe('JPY 96,675.38')
    expect(money(4.5, 'GBP')).toBe('GBP 4.50')
    expect(money(-20)).toBe('-SGD 20.00')
    expect(money(undefined)).toBe('SGD 0.00')
  })
})

test.describe('rates', () => {
  test('two decimals for big rates, four for small ones, and a direction', () => {
    expect(rate(121.019)).toBe('121.02')
    expect(rate(0.58123)).toBe('0.5812')
    expect(rate(0)).toBe('—')
    expect(rateText(121.019, 'JPY')).toBe('1 SGD = 121.02 JPY')
    expect(rateText(null, 'JPY')).toBe('—')
  })
})

test.describe('dates', () => {
  test('calendar days never shift with the timezone', () => {
    expect(day('2027-04-01')).toBe('1 Apr 2027')
    expect(day('2027-04-01T00:00:00')).toBe('1 Apr 2027')
    expect(day('')).toBe('—')
  })

  test('ranges share what they can', () => {
    expect(dayRange('2027-04-01', '2027-04-14')).toBe('1–14 Apr 2027')
    expect(dayRange('2027-03-28', '2027-04-04')).toBe('28 Mar – 4 Apr 2027')
    expect(dayRange('2026-12-28', '2027-01-04')).toBe('28 Dec 2026 – 4 Jan 2027')
    expect(dayRange('2027-04-01', undefined)).toBe('1 Apr 2027')
  })
})
