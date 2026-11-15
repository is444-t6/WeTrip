import { test, expect } from '@playwright/test'

// tripId links the checkout to a trip page; premium is the quoted SGD total.
async function seedValidCheckout(page, { tripId, premium = 12.5 } = {}) {
  await page.addInitScript(
    ({ tripId, premium }) => {
      const start = new Date()
      start.setDate(start.getDate() + 1)
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      const formatDate = (date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }

      sessionStorage.setItem('wetrip_session', 'parent:account:Parent')
      sessionStorage.setItem(
        'wetrip.insurance.draft',
        JSON.stringify({
          insurancePlanId: 1,
          planId: '1',
          planName: 'Test plan',
          coverType: 'individual',
          travellers: [{ name: 'Taylor Example', dob: '2000-01-01', nationalityCode: 'SG' }],
          email: 'taylor@example.com',
          trip: {
            destination: 'Tokyo',
            destinationCode: 'JP',
            startDate: formatDate(start),
            endDate: formatDate(end),
          },
          quote: { totalPremium: premium, currencyCode: 'SGD', tripDays: 2 },
        }),
      )
      if (tripId) {
        sessionStorage.setItem(
          'wetrip.insurance.trip',
          JSON.stringify({ tripId, startDate: formatDate(start), endDate: formatDate(end) }),
        )
      }
    },
    { tripId, premium },
  )
}

// Mocks the plan, the child's miles balance and a purchase; returns what the app sent.
async function mockMilesCheckout(page, { balance }) {
  const seen = { milesRequests: [], purchases: [] }
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Test plan', CurrencyCode: 'SGD', IsActive: true }]),
    }),
  )
  await page.route('**/api/trip/GetTripMiles*', (route) => {
    seen.milesRequests.push(new URL(route.request().url()).searchParams.get('TripId'))
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ ChildBalance: balance }),
    })
  })
  await page.route('**/api/insurance/Purchase', (route) => {
    seen.purchases.push(route.request().postDataJSON())
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ PaymentSuccess: true, PolicyNumber: 'POL-1', Status: 'Confirmed' }),
    })
  })
  return seen
}

test('destination details lead to a separate insurance plan selection step', async ({ page }) => {
  let planRequests = 0
  let benefitsRequests = 0
  await page.route('**/api/insurance/Plans', async (route) => {
    planRequests += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          Id: 1,
          Name: 'Essential',
          CoverageType: 'Individual',
          PremiumPerDay: 3,
          CurrencyCode: 'SGD',
          MaxCoverageAmount: 10000,
          MaxTravellers: 4,
          IsActive: true,
        },
        {
          Id: 2,
          Name: 'Premium',
          CoverageType: 'Family bundle',
          PremiumPerDay: 5,
          CurrencyCode: 'SGD',
          MaxCoverageAmount: 50000,
          MaxTravellers: 1,
          IsActive: true,
        },
      ]),
    })
  })
  await page.route('**/api/insurance/Benefits*', async (route) => {
    benefitsRequests += 1
    expect(new URL(route.request().url()).searchParams.get('InsurancePlanId')).toBe('1')
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        Benefits: {
          List: [
            {
              BenefitName: 'Emergency overseas medical expenses',
              Description: 'Medical expenses for emergencies while travelling.',
              CoverageLimit: 500000,
              IsCovered: true,
              DisplayOrder: 2,
            },
            {
              BenefitName: 'Lost baggage',
              Description: 'Cover for eligible baggage loss.',
              CoverageLimit: 3000,
              IsCovered: true,
              DisplayOrder: 1,
            },
          ],
        },
      }),
    })
  })

  await page.goto('/insurance')

  const insuranceMenu = page.locator('.nav-insurance-menu')
  const insuranceTabs = insuranceMenu.getByRole('navigation', { name: 'Insurance' })
  await expect(insuranceTabs).toBeHidden()
  await insuranceMenu.hover()
  await expect(insuranceTabs).toBeVisible()
  await expect(insuranceTabs.getByRole('link', { name: 'Buy insurance' })).toBeVisible()
  await expect(insuranceTabs.getByRole('link', { name: 'My insurance' })).toBeVisible()
  await expect(insuranceMenu.getByRole('link', { name: 'Insurance', exact: true })).toBeVisible()
  const navbarBox = await page.locator('.navbar-inner').boundingBox()
  const insuranceSubnavBox = await insuranceMenu.locator('.navbar-subnav').boundingBox()
  expect(insuranceSubnavBox.height).toBeGreaterThan(0)
  expect(insuranceSubnavBox.width).toBeLessThan(navbarBox.width / 2)
  await page.locator('.brand').hover()
  await expect(insuranceTabs).toBeHidden()
  await insuranceMenu.getByRole('link', { name: 'Insurance', exact: true }).focus()
  await expect(insuranceTabs).toBeVisible()
  await expect(page.locator('.page').getByRole('navigation', { name: 'Insurance' })).toHaveCount(0)
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
  const essentialCard = page
    .locator('.insurance-plan-card')
    .filter({ has: page.getByRole('heading', { name: 'Essential' }) })
  await expect(essentialCard.locator('.insurance-coverage-badge')).toHaveClass(
    /insurance-coverage-individual/,
  )
  await expect(essentialCard.getByText('Maximum coverage')).toBeVisible()
  await expect(essentialCard.getByText('SGD 10,000.00')).toBeVisible()
  await expect(essentialCard.getByText('Up to 4 people')).toBeVisible()
  await expect(essentialCard.locator('.insurance-coverage-badge')).toHaveText('Individual')
  await expect(essentialCard.getByText('Available', { exact: true })).toHaveCount(0)
  await expect(essentialCard.getByText(/per day/i)).toHaveCount(0)
  const premiumCard = page
    .locator('.insurance-plan-card')
    .filter({ has: page.getByRole('heading', { name: 'Premium' }) })
  const premiumCoverageArea = premiumCard.locator('.insurance-plan-header-coverage')
  await expect(premiumCoverageArea.locator('.insurance-coverage-badge')).toHaveText('Family bundle')
  await expect(premiumCoverageArea.locator('.insurance-coverage-badge')).toHaveClass(
    /insurance-coverage-family/,
  )
  await expect(premiumCoverageArea.getByText('Maximum coverage')).toHaveCount(0)
  await expect(premiumCard.getByText(/people|person/i)).toHaveCount(0)
  const premiumCardBox = await premiumCard.boundingBox()
  const premiumCoverageBox = await premiumCoverageArea.boundingBox()
  expect(
    Math.abs(
      premiumCoverageBox.x +
        premiumCoverageBox.width -
        (premiumCardBox.x + premiumCardBox.width - 20),
    ),
  ).toBeLessThanOrEqual(1)
  const premiumFactsBox = await premiumCard.locator('.insurance-plan-facts').boundingBox()
  const maxCoverageLabel = await premiumCard.getByText('Maximum coverage').boundingBox()
  const cardFooter = await premiumCard.locator('.insurance-plan-card-footer').boundingBox()
  expect(Math.abs(premiumFactsBox.x - premiumCardBox.x)).toBeLessThanOrEqual(1)
  expect(maxCoverageLabel.y).toBeLessThan(cardFooter.y)
  expect(Math.abs(maxCoverageLabel.x - (premiumCardBox.x + 20))).toBeLessThanOrEqual(1)
  const essentialCardBox = await essentialCard.boundingBox()
  const essentialTitle = await essentialCard
    .getByRole('heading', { name: 'Essential' })
    .boundingBox()
  const premiumTitle = await premiumCard.getByRole('heading', { name: 'Premium' }).boundingBox()
  expect(
    Math.abs(essentialTitle.y - essentialCardBox.y - (premiumTitle.y - premiumCardBox.y)),
  ).toBeLessThan(2)
  expect(planRequests).toBeGreaterThan(0)

  await page.getByLabel('Compare plans').check()
  const comparison = page.getByRole('region', { name: 'Plan comparison table' })
  await expect(comparison.getByText('Most cover')).toBeVisible()
  await expect(comparison.getByText(/per day|price/i)).toHaveCount(0)
  await expect(comparison.getByRole('button', { name: 'Choose plan' })).toHaveCount(2)
  await expect(
    page.getByRole('region', { name: 'Proposed coverage benefit comparison' }),
  ).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Essential' })).toHaveCount(0)

  await page.getByLabel('Compare plans').uncheck()
  await expect(page.getByRole('heading', { name: 'Essential' })).toBeVisible()
  await page.getByRole('button', { name: 'Choose plan' }).first().click()
  await expect(page.getByRole('heading', { name: 'Essential' })).toBeVisible()
  await expect(page.getByText(/per day|premium per day/i)).toHaveCount(0)
  await expect(page.locator('.insurance-plan-detail-card')).toHaveCount(1)
  await expect(page.locator('.insurance-plan-detail-card .card')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Plan information' })).toBeVisible()
  await expect(page.getByText('Maximum coverage')).toBeVisible()
  await expect(page.getByText('SGD 10,000.00', { exact: true })).toBeVisible()
  await expect(page.getByText('Plan status')).toHaveCount(0)
  await expect(page.getByText('4 people')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plan benefits' })).toBeVisible()
  const benefitItems = page.locator('.insurance-plan-benefit')
  await expect(benefitItems).toHaveCount(2)
  await expect(benefitItems.nth(0).getByRole('heading')).toHaveText('Lost baggage')
  await expect(benefitItems.nth(1).getByRole('heading')).toHaveText(
    'Emergency overseas medical expenses',
  )
  await expect(page.getByRole('heading', { name: /trip cancellation/i })).toHaveCount(0)
  await expect(page.getByText('Medical expenses for emergencies while travelling.')).toBeVisible()
  await expect(page.getByText('S$500,000')).toBeVisible()
  await expect(page.getByText('S$3,000')).toBeVisible()
  await expect(page.getByText('Included').first()).toBeVisible()
  expect(benefitsRequests).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Continue with your plan' })).toBeVisible()
  await expect(page.getByText('Review your quote')).toBeVisible()
  await page.getByRole('button', { name: 'Choose this plan' }).click()
  await expect(page.getByRole('heading', { name: 'Traveller details' })).toBeVisible()
  await expect(page.getByText(/per day/i)).toHaveCount(0)
})

test('signing out from an insurance page returns to the front door, like every page', async ({
  page,
}) => {
  // Seed once: signing out reloads, and a re-seed would sign straight back in.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('wetrip_session', 'parent:account:Parent')
      sessionStorage.setItem('seeded', '1')
    }
  })
  await page.goto('/insurance')

  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText("You're not signed in yet.")).toBeVisible()
  await expect(page.getByRole('link', { name: 'Continue to sign in' })).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('wetrip_session'))).toBeNull()
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
  expect(await departure.evaluate((input) => input.validity.rangeUnderflow)).toBe(true)
  await expect(returnDate).toHaveAttribute('min', today)

  await page.getByRole('button', { name: 'Continue to insurance plans' }).click()
  await expect(page).toHaveURL(/\/insurance(?:\?.*)?$/)
})

test('date of birth must be before today and within a reasonable range', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'wetrip.insurance.trip',
      JSON.stringify({
        destination: 'Tokyo, Japan',
        destinationCode: 'JP',
        startDate: '2027-01-10',
        endDate: '2027-01-17',
      }),
    )
  })
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Individual', MaxTravellers: 1, IsActive: true }]),
    }),
  )

  await page.goto('/insurance/travellers?planId=1')

  const dob = page.getByLabel('Date of birth')
  const max = await dob.getAttribute('max')
  const min = await dob.getAttribute('min')
  expect(max).toBeTruthy()
  expect(min).toBeTruthy()

  const today = new Date(`${max}T00:00:00.000Z`)
  today.setUTCDate(today.getUTCDate() + 1)
  await dob.fill(today.toISOString().slice(0, 10))
  expect(await dob.evaluate((input) => input.validity.rangeOverflow)).toBe(true)

  const tooOld = new Date(`${min}T00:00:00.000Z`)
  tooOld.setUTCDate(tooOld.getUTCDate() - 1)
  await dob.fill(tooOld.toISOString().slice(0, 10))
  expect(await dob.evaluate((input) => input.validity.rangeUnderflow)).toBe(true)
})

test('checkout rejects a saved trip with past travel dates', async ({ page }) => {
  let purchaseRequests = 0
  await page.addInitScript(() => {
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)

    sessionStorage.setItem(
      'wetrip.insurance.draft',
      JSON.stringify({
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
      }),
    )
  })
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Test plan', IsActive: true }]),
    }),
  )
  await page.route('**/api/insurance/Purchase', async (route) => {
    purchaseRequests += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ PolicyNumber: 'POL-1' }),
    })
  })

  await page.goto('/insurance/checkout')
  await page.getByRole('button', { name: 'Confirm purchase' }).click()

  await expect(page.getByText(/Travel dates must start today or later/)).toBeVisible()
  expect(purchaseRequests).toBe(0)
})

test('checkout presents the API quote as the final price for covered days', async ({ page }) => {
  await page.addInitScript(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const dayAfter = new Date(tomorrow)
    dayAfter.setDate(dayAfter.getDate() + 1)
    const formatDate = (date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    sessionStorage.setItem(
      'wetrip.insurance.draft',
      JSON.stringify({
        insurancePlanId: 1,
        planId: '1',
        planName: 'Test plan',
        coverType: 'individual',
        travellers: [{ name: 'Taylor Example', dob: '2000-01-01', nationalityCode: 'SG' }],
        email: 'taylor@example.com',
        trip: {
          destination: 'Tokyo',
          destinationCode: 'JP',
          startDate: formatDate(tomorrow),
          endDate: formatDate(dayAfter),
        },
        quote: { totalPremium: 12.5, currencyCode: 'SGD', tripDays: 2 },
      }),
    )
  })
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Test plan', IsActive: true }]),
    }),
  )

  await page.goto('/insurance/checkout')

  await expect(page.getByText('Final quoted premium · 2 covered days')).toBeVisible()
  await expect(page.getByText('Final price calculated by the insurance service')).toBeVisible()
  await expect(page.getByText('SGD 12.50')).toBeVisible()
  await expect(page.getByText(/estimate/i)).toHaveCount(0)
})

test('successful insurance payment confirms purchase and refreshes the Family wallet balance', async ({
  page,
}) => {
  let familyMeRequests = 0
  await seedValidCheckout(page)
  await page.route('**/GetMyFamilyRole*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ Role: 'Parent' }),
    }),
  )
  await page.route('**/GetMe*', async (route) => {
    familyMeRequests += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        DisplayName: 'Parent',
        CustomerId: 'parent',
        Balance: familyMeRequests === 1 ? 100 : 86.25,
      }),
    })
  })
  await page.route('**/GetChildren*', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/GetPendingRequests*', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  )
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Test plan', CurrencyCode: 'SGD', IsActive: true }]),
    }),
  )
  await page.route('**/api/insurance/Purchase', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        PaymentSuccess: true,
        PaymentMessage: 'Payment successful from SMUtBank.',
        PolicyNumber: 'POL-2026-001',
        PurchaseId: 77,
        TotalPremium: 12.5,
        PaymentFee: 1.25,
        CurrencyCode: 'SGD',
        Status: 'Confirmed',
      }),
    }),
  )

  await page.goto('/family')
  await expect(page.getByText('Your WeTrip balance')).toBeVisible()
  await expect(page.getByText('SGD 100.00')).toBeVisible()
  expect(familyMeRequests).toBe(1)

  await page.goto('/insurance/checkout')
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page).toHaveURL(/\/insurance\/confirmation$/)
  await expect(page.getByRole('heading', { name: 'Insurance purchase confirmed' })).toBeVisible()
  await expect(page.getByRole('status')).toHaveText('Payment successful from SMUtBank.')
  await expect(page.getByText('POL-2026-001')).toBeVisible()
  await expect(page.getByText('SGD 12.50')).toBeVisible()
  await expect(page.getByText('SGD 1.25')).toBeVisible()
  await expect(page.getByText('SGD 13.75')).toBeVisible()
  await expect(page.getByText('Confirmed', { exact: true })).toBeVisible()

  await page.locator('.navbar').getByRole('link', { name: 'Family', exact: true }).click()
  await expect(page.getByText('Your WeTrip balance')).toBeVisible()
  await expect(page.getByText('SGD 86.25')).toBeVisible()
  expect(familyMeRequests).toBe(2)
})

test('unsuccessful insurance payment stays at checkout and displays the bank error', async ({
  page,
}) => {
  let purchaseRequests = 0
  await seedValidCheckout(page)
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ Id: 1, Name: 'Test plan', CurrencyCode: 'SGD', IsActive: true }]),
    }),
  )
  await page.route('**/api/insurance/Purchase', async (route) => {
    purchaseRequests += 1
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        PaymentSuccess: false,
        PaymentMessage: 'SMUtBank declined the payment.',
        PolicyNumber: 'MUST-NOT-BE-SHOWN',
        TotalPremium: 12.5,
        CurrencyCode: 'SGD',
        Status: 'Declined',
      }),
    })
  })

  await page.goto('/insurance/checkout')
  await page.getByRole('button', { name: 'Confirm purchase' }).click()

  await expect(page).toHaveURL(/\/insurance\/checkout$/)
  await expect(page.getByRole('alert')).toHaveText('SMUtBank declined the payment.')
  await expect(page.getByRole('heading', { name: 'Insurance purchase confirmed' })).toHaveCount(0)
  await expect(page.getByText('MUST-NOT-BE-SHOWN')).toHaveCount(0)
  await page.waitForTimeout(300)
  expect(purchaseRequests).toBe(1)
})

test('checkout offers the trip child miles, unchecked, and sends them on purchase', async ({
  page,
}) => {
  await seedValidCheckout(page, { tripId: 7, premium: 30 })
  const seen = await mockMilesCheckout(page, { balance: 1250 })

  await page.goto('/insurance/checkout')
  const offer = page.getByRole('checkbox', { name: 'Use 1250 miles (SGD 12.50 off)' })
  await expect(offer).toBeVisible()
  await expect(offer).not.toBeChecked()
  expect(seen.milesRequests).toEqual(['7'])

  await offer.check()
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page).toHaveURL(/\/insurance\/confirmation$/)
  expect(seen.purchases).toHaveLength(1)
  expect(seen.purchases[0].TripId).toBe(7)
  expect(seen.purchases[0].RedeemMiles).toBe(1250)
  expect(seen.purchases[0].RequestId).toMatch(/\S+/)
})

test('checkout redeems nothing unless the box is ticked', async ({ page }) => {
  await seedValidCheckout(page, { tripId: 7, premium: 30 })
  const seen = await mockMilesCheckout(page, { balance: 1250 })

  await page.goto('/insurance/checkout')
  await expect(page.getByRole('checkbox', { name: /Use 1250 miles/ })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page).toHaveURL(/\/insurance\/confirmation$/)
  expect(seen.purchases[0].RedeemMiles).toBe(0)
})

test('the miles offer is capped so SGD 0.01 is still charged', async ({ page }) => {
  await seedValidCheckout(page, { tripId: 7, premium: 10 })
  await mockMilesCheckout(page, { balance: 5000 })

  await page.goto('/insurance/checkout')
  await expect(page.getByRole('checkbox', { name: 'Use 999 miles (SGD 9.99 off)' })).toBeVisible()
})

test('a declined purchase gets a new RequestId for the next attempt', async ({ page }) => {
  await seedValidCheckout(page, { tripId: 7, premium: 30 })
  const seen = await mockMilesCheckout(page, { balance: 1250 })
  await page.route('**/api/insurance/Purchase', (route) => {
    seen.purchases.push(route.request().postDataJSON())
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ PaymentSuccess: false, PaymentMessage: 'Declined.' }),
    })
  })

  await page.goto('/insurance/checkout')
  await page.getByRole('checkbox', { name: /Use 1250 miles/ }).check()
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect(page.getByRole('alert')).toHaveText('Declined.')
  await page.getByRole('button', { name: 'Confirm purchase' }).click()
  await expect.poll(() => seen.purchases.length).toBe(2)
  expect(seen.purchases[1].RedeemMiles).toBe(1250)
  expect(seen.purchases[1].RequestId).not.toBe(seen.purchases[0].RequestId)
})

test('no miles option when the child has 0 miles or the balance call fails', async ({ page }) => {
  const checkbox = page.getByRole('checkbox')
  await seedValidCheckout(page, { tripId: 7, premium: 30 })
  const seen = await mockMilesCheckout(page, { balance: 0 })

  await page.goto('/insurance/checkout')
  await expect.poll(() => seen.milesRequests.length).toBe(1)
  await expect(page.getByRole('button', { name: 'Confirm purchase' })).toBeVisible()
  await expect(checkbox).toHaveCount(0)

  await page.route('**/api/trip/GetTripMiles*', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Confirm purchase' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(checkbox).toHaveCount(0)
})

test('no miles option, and no balance lookup, when the purchase has no trip', async ({ page }) => {
  await seedValidCheckout(page, { premium: 30 })
  const seen = await mockMilesCheckout(page, { balance: 1250 })

  await page.goto('/insurance/checkout')
  await expect(page.getByRole('button', { name: 'Confirm purchase' })).toBeVisible()
  await page.waitForTimeout(300)
  await expect(page.getByRole('checkbox')).toHaveCount(0)
  expect(seen.milesRequests).toHaveLength(0)
})

test('expired insurance policies use the red status badge', async ({ page }) => {
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([]),
    }),
  )
  await page.route('**/api/insurance/MyInsurance', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
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
        },
      ]),
    }),
  )

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
  await expect(page.locator('.insurance-policy-extra')).toContainText('SGD 20.00')

  await page.getByRole('button', { name: /Hide details/ }).click()
  await expect(page.getByRole('heading', { name: 'Who is covered' })).toHaveCount(0)
})

test('family bundle reveals linked children for multi-select', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('wetrip_session', '0000002169:0000004554:Parent Demo')
    sessionStorage.setItem(
      'wetrip.insurance.trip',
      JSON.stringify({
        destination: 'Tokyo, Japan',
        destinationCode: 'JP',
        startDate: '2027-01-10',
        endDate: '2027-01-17',
      }),
    )
  })
  await page.route('**/api/insurance/Plans', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          Id: 1,
          Name: 'Family Cover',
          PremiumPerDay: 5,
          CurrencyCode: 'SGD',
          MaxTravellers: 4,
          IsActive: true,
        },
      ]),
    }),
  )
  await page.route('**/GetChildren*', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { FamilyLinkId: 10, ChildCustomerId: '0000002828', Nickname: 'Jamie', Status: 'Active' },
        { FamilyLinkId: 11, ChildCustomerId: '0000002829', Nickname: 'Alex', Status: 'Active' },
      ]),
    }),
  )

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

test('confirmation total falls back to the premium when the bank fee is missing', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('wetrip_session', 'parent:account:Parent')
    sessionStorage.setItem(
      'wetrip.insurance.purchaseResult',
      JSON.stringify({ paymentSuccess: true, premium: 12.5, currencyCode: 'SGD' }),
    )
  })
  await page.goto('/insurance/confirmation')
  const total = page.locator('.row-between', { hasText: 'Total wallet deduction' })
  await expect(total).toContainText('SGD 12.50')
})
