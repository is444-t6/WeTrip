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

test('travel insurance does not allow departure dates in the past', async ({ page }) => {
  await page.goto('/insurance')

  const departure = page.getByLabel('Depart')
  const returnDate = page.getByLabel('Return')
  const today = await departure.getAttribute('min')
  expect(today).toBeTruthy()
  await expect(returnDate).toHaveAttribute('min', today)

  const yesterday = new Date(`${today}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const pastDate = yesterday.toISOString().slice(0, 10)
  await departure.fill(pastDate)
  expect(await departure.evaluate(input => input.validity.rangeUnderflow)).toBe(true)
  await expect(returnDate).toHaveAttribute('min', today)

  await page.getByRole('button', { name: 'Continue to insurance plans' }).click()
  await expect(page).toHaveURL(/\/insurance(?:\?.*)?$/)
})

test('date of birth must be before today and within a reasonable range', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('wetrip.insurance.trip', JSON.stringify({
      destination: 'Tokyo, Japan',
      destinationCode: 'JP',
      startDate: '2027-01-10',
      endDate: '2027-01-17',
    }))
  })
  await page.route('**/InsuranceAPI/Plans', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ Id: 1, Name: 'Individual', MaxTravellers: 1, IsActive: true }]),
  }))

  await page.goto('/insurance/travellers?planId=1')

  const dob = page.getByLabel('Date of birth')
  const max = await dob.getAttribute('max')
  const min = await dob.getAttribute('min')
  expect(max).toBeTruthy()
  expect(min).toBeTruthy()

  const today = new Date(`${max}T00:00:00.000Z`)
  today.setUTCDate(today.getUTCDate() + 1)
  await dob.fill(today.toISOString().slice(0, 10))
  expect(await dob.evaluate(input => input.validity.rangeOverflow)).toBe(true)

  const tooOld = new Date(`${min}T00:00:00.000Z`)
  tooOld.setUTCDate(tooOld.getUTCDate() - 1)
  await dob.fill(tooOld.toISOString().slice(0, 10))
  expect(await dob.evaluate(input => input.validity.rangeUnderflow)).toBe(true)
})

test('checkout rejects a saved trip with past travel dates', async ({ page }) => {
  let purchaseRequests = 0
  await page.addInitScript(() => {
    const formatDate = date => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    sessionStorage.setItem('wetrip.insurance.draft', JSON.stringify({
      insurancePlanId: 1,
      planId: '1',
      planName: 'Test plan',
      coverType: 'individual',
      travellers: [{ name: 'Taylor Example', dob: '2000-01-01', nationalityCode: 'SG' }],
      email: 'taylor@example.com',
      trip: {
        destination: 'Tokyo',
        destinationCode: 'JP',
        startDate: formatDate(yesterday),
        endDate: formatDate(tomorrow),
      },
      quote: { totalPremium: 10, currencyCode: 'SGD' },
    }))
  })
  await page.route('**/InsuranceAPI/Plans', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ Id: 1, Name: 'Test plan', IsActive: true }]),
  }))
  await page.route('**/InsuranceAPI/Purchase', async route => {
    purchaseRequests += 1
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ PolicyNumber: 'POL-1' }) })
  })

  await page.goto('/insurance/checkout')
  await page.getByRole('button', { name: 'Confirm purchase' }).click()

  await expect(page.getByText(/Travel dates must start today or later/)).toBeVisible()
  expect(purchaseRequests).toBe(0)
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
      DestinationCode: 'JP',
      CoverageStart: '2026-01-01',
      CoverageEnd: '2026-01-08',
      PurchasedOn: '2025-12-20',
      Travellers: [
        { FullName: 'Jamie Example', DateOfBirth: '2012-04-15' },
        { FullName: 'Alex Example', DateOfBirth: '2010-09-22' },
      ],
    }]),
  }))

  await page.goto('/insurance/policies')

  await expect(page.locator('.badge.removed')).toHaveText('Expired')
  await expect(page.getByText('Destination', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Premium paid')).toHaveCount(0)
  await expect(page.getByText('Purchased', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: /More information/ }).click()
  await expect(page.getByRole('heading', { name: 'Who is covered' })).toBeVisible()
  await expect(page.getByText('2 travellers')).toBeVisible()
  await expect(page.getByText('People insured under this policy')).toBeVisible()
  await expect(page.getByText('Jamie Example')).toBeVisible()
  await expect(page.getByText('Alex Example')).toBeVisible()
  await expect(page.getByText('JE', { exact: true })).toBeVisible()
  await expect(page.getByText('AE', { exact: true })).toBeVisible()
  await expect(page.getByText('Covered', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Premium paid')).toBeVisible()
  await expect(page.getByText('Purchased', { exact: true })).toBeVisible()
  await expect(page.getByText('Destination', { exact: true })).toBeVisible()
  await expect(page.locator('.insurance-policy-detail')).toHaveCount(3)
  await expect(page.locator('.insurance-policy-extra')).toContainText('$20.00')

  await page.getByRole('button', { name: /Hide details/ }).click()
  await expect(page.getByRole('heading', { name: 'Who is covered' })).toHaveCount(0)
})

test('family bundle reveals linked children for multi-select', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('wetrip_session', '0000002169:0000004554:Parent Demo')
    sessionStorage.setItem('wetrip.insurance.trip', JSON.stringify({
      destination: 'Tokyo, Japan',
      destinationCode: 'JP',
      startDate: '2027-01-10',
      endDate: '2027-01-17',
    }))
  })
  await page.route('**/InsuranceAPI/Plans', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      Id: 1,
      Name: 'Family Cover',
      PremiumPerDay: 5,
      CurrencyCode: 'SGD',
      MaxTravellers: 4,
      IsActive: true,
    }]),
  }))
  await page.route('**/GetChildren*', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([
      { FamilyLinkId: 10, ChildCustomerId: '0000002828', Nickname: 'Jamie', Status: 'Active' },
      { FamilyLinkId: 11, ChildCustomerId: '0000002829', Nickname: 'Alex', Status: 'Active' },
    ]),
  }))

  await page.goto('/insurance/travellers?planId=1')
  await page.getByLabel('Who are you covering?').selectOption('family')
  await expect(page.getByLabel('Select my linked children')).toBeVisible()
  await page.getByLabel('Select my linked children').check()

  const childOptions = page.locator('.insurance-child-option')
  await expect(childOptions).toHaveCount(2)
  await childOptions.nth(0).getByRole('checkbox').check()
  await childOptions.nth(1).getByRole('checkbox').check()
  await expect(page.getByRole('heading', { name: 'Child traveller 1' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Child traveller 2' })).toBeVisible()
  await expect(page.getByLabel('Full name').nth(0)).toHaveValue('Jamie')
  await expect(page.getByLabel('Full name').nth(1)).toHaveValue('Alex')
})
