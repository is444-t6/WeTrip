import { expect, test } from '@playwright/test'
import { CATEGORIES } from '../src/features/budget/constants.js'

// Cash receipts on a trip: the form on /trips/:id (child only) and the receipt
// rows on /budget/:id. AddReceipt and GetReceipt are answered in the browser, so
// nothing reaches the backend.
const CHILD = '0000002828:0000006064:Jamie'
const PARENT = '0000002169:0000004554:Parent Demo'
const as = (page, v) => page.addInitScript((x) => sessionStorage.setItem('wetrip_session', x), v)
const json = (body, status = 200) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(body),
})
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const TRIP = {
  Id: 12,
  FamilyLinkId: 3,
  Destination: 'Kyoto',
  Currency: 'JPY',
  TripStartDate: '2027-04-01',
  TripEndDate: '2027-04-14',
  TargetBudgetSgd: 800,
  Status: 'Locked',
  LockedSgd: 400,
  LockedForeign: 48000, // 120 JPY per SGD
}
const NOTHING_LOCKED = { ...TRIP, Status: 'Watching', LockedSgd: 0, LockedForeign: 0 }
const overview = (trip, spent, role) => ({
  Trip: trip,
  Locks: [],
  Spends: [],
  SpentForeign: 0,
  RemainingForeign: trip.LockedForeign,
  LockedRate: trip.LockedForeign ? 120 : 0,
  HasBudget: true,
  Budget: { TripId: 12, TotalLimit: 600, TotalSpent: spent, Lines: [{ CategoryName: 'Food' }] },
  Policies: [],
  CallerRole: role,
})
const RECEIPT_ROWS = [
  { Id: 1, ExpenseDate: '2027-04-02T10:00:00', MerchantName: 'Cash receipt', CategoryId: 6 },
  { Id: 2, ExpenseDate: '2027-04-03T10:00:00', MerchantName: 'Cash receipt', CategoryId: 6 },
  { Id: 3, ExpenseDate: '2027-04-04T10:00:00', MerchantName: 'Ramen', CategoryId: 6 },
].map((e, i) => ({
  ...e,
  Amount: 10,
  Currency: 'SGD',
  SourceId: i < 2 ? 3 : 1,
  ReceiptId: i === 0 ? 9 : 0,
}))

// Each service answers by method name; `calls` records what the receipt endpoints saw.
async function mockApi(page, { role = 'Child', trip = TRIP, addReceipt, receipts = [] } = {}) {
  const calls = { add: [], get: [] }
  let spent = 150
  const handlers = {
    GetMyFamilyRole: () => ({ role, FamilyLinkId: 3 }),
    GetTripOverview: () => overview(trip, spent, role),
    GetChildren: () => [],
    GetChildDashboard: () => ({}),
    MyInsurance: () => [],
    GetTrip: () => ({ Trip: TRIP, Locks: [], Spends: [] }),
    GetDashboard: () => ({ Summary: { TripId: 12, Lines: [] }, Expenses: receipts }),
    AddReceipt: async (route) => {
      calls.add.push(route.request().postDataJSON())
      if (addReceipt) return addReceipt()
      spent += 10
      return { ExpenseId: 77, AmountSgd: 10 }
    },
    GetReceipt: (route) => {
      calls.get.push(new URL(route.request().url()).searchParams.get('ReceiptId'))
      return { ContentType: 'image/png', ImageBase64: TINY_PNG }
    },
  }
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    async (route) => {
      const name = new URL(route.request().url()).pathname.split('/').pop()
      const h = handlers[name]
      if (!h) return route.fulfill(json({ Errors: [`unmocked ${name}`] }, 500))
      const out = await h(route)
      return route.fulfill(out?.__status ? json(out.body, out.__status) : json(out))
    },
  )
  return calls
}

const addButton = (page) => page.getByRole('button', { name: 'Add a receipt' })
const form = (page) => page.getByRole('heading', { name: 'Add a receipt' })
const budget = (page) => page.getByLabel('Budget', { exact: true })

async function fill(page, amount, category = 'Food') {
  await page.getByLabel('Amount', { exact: true }).fill(amount)
  if (category) await page.getByLabel('Category', { exact: true }).selectOption({ label: category })
}

// A flat-colour PNG made in the page.
const makePng = (page, width, height) =>
  page.evaluate(
    ([w, h]) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx.fillStyle = '#789'
      ctx.fillRect(0, 0, w, h)
      return c.toDataURL('image/png').split(',')[1]
    },
    [width, height],
  )
const attach = async (page, base64) =>
  page.getByLabel(/Photo of the receipt/).setInputFiles({
    name: 'receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from(base64, 'base64'),
  })

test('the child sees Add a receipt on an open trip', async ({ page }) => {
  await as(page, CHILD)
  await mockApi(page)
  await page.goto('/trips/12')
  await expect(addButton(page)).toBeVisible()
})

test('the parent does not see Add a receipt', async ({ page }) => {
  await as(page, PARENT)
  await mockApi(page, { role: 'Parent' })
  await page.goto('/trips/12')
  await expect(page.getByRole('heading', { name: 'Kyoto' })).toBeVisible()
  await expect(addButton(page)).toHaveCount(0)
})

for (const status of ['Completed', 'Cancelled']) {
  test(`no Add a receipt on a ${status} trip`, async ({ page }) => {
    await as(page, CHILD)
    await mockApi(page, { trip: { ...TRIP, Status: status } })
    await page.goto('/trips/12')
    await expect(page.getByText(status, { exact: true })).toBeVisible()
    await expect(addButton(page)).toHaveCount(0)
  })
}

test('the form has a photo, an amount, the trip currency or SGD, and a category', async ({
  page,
}) => {
  await as(page, CHILD)
  await mockApi(page)
  await page.goto('/trips/12')
  await addButton(page).click()

  await expect(page.getByLabel(/Photo of the receipt/)).toHaveAttribute(
    'accept',
    'image/jpeg,image/png',
  )
  await expect(page.getByLabel('Amount', { exact: true })).toBeVisible()
  const currency = page.getByLabel('Currency', { exact: true })
  await expect(currency).toHaveValue('JPY')
  await expect(currency.locator('option')).toHaveText(['JPY', 'SGD'])
  await expect(page.getByLabel('Category', { exact: true }).locator('option')).toHaveText([
    'Choose a category',
    ...CATEGORIES.map((c) => c.label),
  ])
})

test('submitting JPY 1200 in Food sends one request, closes the form and refreshes the budget', async ({
  page,
}) => {
  await as(page, CHILD)
  const calls = await mockApi(page)
  await page.goto('/trips/12')
  await expect(budget(page)).toContainText('SGD 150.00 spent of SGD 600.00')
  await addButton(page).click()
  await fill(page, '1200')
  await page.getByRole('button', { name: 'Save receipt' }).click()

  await expect(form(page)).toHaveCount(0)
  await expect(budget(page)).toContainText('SGD 160.00 spent of SGD 600.00')
  expect(calls.add).toHaveLength(1)
  expect(calls.add[0]).toMatchObject({ TripId: 12, Amount: 1200, Currency: 'JPY', CategoryId: 6 })
  expect(calls.add[0].RequestId).toBeTruthy()
  expect(calls.add[0]).not.toHaveProperty('ImageBase64')

  // A second receipt is a new attempt with its own request id.
  await addButton(page).click()
  await fill(page, '300')
  await page.getByRole('button', { name: 'Save receipt' }).click()
  await expect(form(page)).toHaveCount(0)
  expect(calls.add).toHaveLength(2)
  expect(calls.add[1].RequestId).not.toBe(calls.add[0].RequestId)
})

test('a photo is shrunk to 1280 px on its longest edge and sent as a JPEG', async ({ page }) => {
  await as(page, CHILD)
  const calls = await mockApi(page)
  await page.goto('/trips/12')
  await addButton(page).click()
  await attach(page, await makePng(page, 2000, 1000))
  await fill(page, '1200')
  await page.getByRole('button', { name: 'Save receipt' }).click()

  await expect(form(page)).toHaveCount(0)
  expect(calls.add).toHaveLength(1)
  expect(calls.add[0].ContentType).toBe('image/jpeg')
  const size = await page.evaluate(async (b64) => {
    const blob = await (await fetch(`data:image/jpeg;base64,${b64}`)).blob()
    const bitmap = await createImageBitmap(blob)
    return [bitmap.width, bitmap.height]
  }, calls.add[0].ImageBase64)
  expect(size).toEqual([1280, 640])
})

test('a photo still over 1 MB after shrinking is refused and nothing is sent', async ({ page }) => {
  await as(page, CHILD)
  const calls = await mockApi(page)
  // Real JPEGs of a 1280 px photo rarely pass 1 MB, so make the encoder return 1.5 MB.
  await page.addInitScript(() => {
    const toDataURL = HTMLCanvasElement.prototype.toDataURL
    HTMLCanvasElement.prototype.toDataURL = function (type, quality) {
      return type === 'image/jpeg'
        ? `data:image/jpeg;base64,${'A'.repeat(2 * 1024 * 1024)}`
        : toDataURL.call(this, type, quality)
    }
  })
  await page.goto('/trips/12')
  await addButton(page).click()
  await attach(page, await makePng(page, 1600, 900))
  await expect(page.getByText('That photo is too large')).toBeVisible()
  await fill(page, '1200')
  await page.getByRole('button', { name: 'Save receipt' }).click()
  await page.waitForTimeout(200)
  expect(calls.add).toHaveLength(0)
  await expect(form(page)).toBeVisible()
})

test('an empty or zero amount, or no category, sends nothing', async ({ page }) => {
  await as(page, CHILD)
  const calls = await mockApi(page)
  await page.goto('/trips/12')
  await addButton(page).click()
  const save = page.getByRole('button', { name: 'Save receipt' })
  const alert = page.getByRole('alert')

  await fill(page, '', 'Food')
  await save.click()
  await expect(alert).toHaveText('Enter an amount above 0')
  await fill(page, '0', null)
  await save.click()
  await expect(alert).toHaveText('Enter an amount above 0')
  await fill(page, '-5', null)
  await save.click()
  await expect(alert).toHaveText('Enter an amount above 0')

  await page.getByLabel('Category', { exact: true }).selectOption({ label: 'Choose a category' })
  await fill(page, '1200', null)
  await save.click()
  await expect(alert).toHaveText('Pick a category')
  expect(calls.add).toHaveLength(0)
})

test('an SGD receipt on a trip with nothing locked is accepted', async ({ page }) => {
  await as(page, CHILD)
  const calls = await mockApi(page, { trip: NOTHING_LOCKED })
  await page.goto('/trips/12')
  await addButton(page).click()
  await page.getByLabel('Currency', { exact: true }).selectOption('SGD')
  await fill(page, '15')
  await page.getByRole('button', { name: 'Save receipt' }).click()

  await expect(form(page)).toHaveCount(0)
  expect(calls.add[0]).toMatchObject({ Amount: 15, Currency: 'SGD' })
})

test('a foreign receipt with nothing locked shows the server message and stays open', async ({
  page,
}) => {
  await as(page, CHILD)
  const calls = await mockApi(page, {
    trip: NOTHING_LOCKED,
    addReceipt: () => ({
      __status: 400,
      body: { Errors: ['Lock a rate first so we can convert this receipt'] },
    }),
  })
  await page.goto('/trips/12')
  await addButton(page).click()
  await fill(page, '1200')
  await page.getByRole('button', { name: 'Save receipt' }).click()

  await expect(page.getByText('Lock a rate first so we can convert this receipt')).toBeVisible()
  await expect(form(page)).toBeVisible()
  expect(calls.add).toHaveLength(1)
})

test('a double click on Save receipt sends one request', async ({ page }) => {
  await as(page, CHILD)
  const calls = await mockApi(page, {
    addReceipt: async () => {
      await new Promise((r) => setTimeout(r, 300))
      return { ExpenseId: 77, AmountSgd: 10 }
    },
  })
  await page.goto('/trips/12')
  await addButton(page).click()
  await fill(page, '1200')
  await page.getByRole('button', { name: 'Save receipt' }).dblclick()

  await expect(form(page)).toHaveCount(0)
  expect(calls.add).toHaveLength(1)
})

for (const [who, session, role] of [
  ['the child', CHILD, 'Child'],
  ['the parent', PARENT, 'Parent'],
]) {
  test(`${who} sees receipt rows in the budget and opens a receipt photo`, async ({ page }) => {
    await as(page, session)
    const calls = await mockApi(page, { role, receipts: RECEIPT_ROWS })
    await page.goto('/budget/12')

    const rows = page.getByRole('row') // 0 is the header
    const [withPhoto, withoutPhoto, manual] = [rows.nth(1), rows.nth(2), rows.nth(3)]
    await expect(withPhoto.getByText('Receipt', { exact: true })).toBeVisible()
    await expect(withoutPhoto.getByText('Receipt', { exact: true })).toBeVisible()
    await expect(withoutPhoto.getByRole('button', { name: 'Receipt' })).toHaveCount(0)
    await expect(manual.getByText('Receipt', { exact: true })).toHaveCount(0)
    expect(calls.get).toEqual([])

    await withPhoto.getByRole('button', { name: 'Receipt' }).click()
    const photo = page.getByRole('dialog', { name: 'Receipt photo' }).getByRole('img')
    await expect(photo).toHaveAttribute('src', `data:image/png;base64,${TINY_PNG}`)
    expect(calls.get).toEqual(['9'])
    await page.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}
