import { test, expect } from '@playwright/test'

test('destination details lead to a separate insurance plan selection step', async ({ page }) => {
  let planRequests = 0
  await page.route('**/InsuranceAPI/Plans', async route => {
    planRequests += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          Id: 1,
          Name: 'Essential',
          CoverageType: 'Travel cover',
          PremiumPerDay: 3,
          CurrencyCode: 'SGD',
          MaxCoverageAmount: 10000,
          MaxTravellers: 4,
          IsActive: true,
        },
        {
          Id: 2,
          Name: 'Premium',
          CoverageType: 'Extended cover',
          PremiumPerDay: 5,
          CurrencyCode: 'SGD',
          MaxCoverageAmount: 50000,
          MaxTravellers: 6,
          IsActive: true,
        },
      ]),
    })
  })

  await page.goto('/insurance')

  await expect(page.getByText('Destination details', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Choose an insurance plan' })).toHaveCount(0)
  expect(planRequests).toBe(0)

  await page.getByLabel('Destination', { exact: true }).fill('Tokyo, Japan')
  await page.getByLabel('Destination country code').fill('JP')
  await page.getByLabel('Depart').fill('2027-01-10')
  await page.getByLabel('Return').fill('2027-01-17')
  await page.getByRole('button', { name: 'Continue to insurance plans' }).click()

  await expect(page).toHaveURL(/\/insurance\/plans$/)
  await expect(page.getByRole('heading', { name: 'Choose an insurance plan' })).toBeVisible()
  await expect(page.getByText('Tokyo, Japan (JP)')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Essential' })).toBeVisible()
  expect(planRequests).toBeGreaterThan(0)

  await page.getByLabel('Compare plans').check()
  const comparison = page.getByRole('region', { name: 'Plan comparison table' })
  await expect(comparison.getByText('Lowest price')).toBeVisible()
  await expect(comparison.getByText('Most cover')).toBeVisible()
  await expect(comparison.getByRole('button', { name: 'Choose plan' })).toHaveCount(2)
  await expect(page.getByRole('heading', { name: 'Essential' })).toHaveCount(0)

  await page.getByLabel('Compare plans').uncheck()
  await expect(page.getByRole('heading', { name: 'Essential' })).toBeVisible()
})

test('expired insurance policies use the red status badge', async ({ page }) => {
  await page.route('**/InsuranceAPI/Plans', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([]),
  }))
  await page.route('**/InsuranceAPI/MyInsurance', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      PurchaseId: 12,
      InsurancePlanId: 1,
      Status: 'Expired',
      PolicyNumber: 'POL-12',
      TotalPremium: 20,
      CurrencyCode: 'SGD',
    }]),
  }))

  await page.goto('/insurance/policies')

  await expect(page.locator('.badge.removed')).toHaveText('Expired')
})
