// Deep smoke test for Family_Atomic's FamilyData REST API. Goes beyond the
// build guide's Task 10 happy-path table to also probe validation errors,
// not-found cases, and upsert/idempotency behavior for every method.
//
// Usage:
//   node --env-file=.env.test scripts/test-atomic.mjs
//
// Needs in .env.test: ATOMIC_BASE, ATOMIC_API_KEY, ATOMIC_TEST_PARENT_ID,
// ATOMIC_TEST_CHILD_ID, ATOMIC_TEST_MERCHANT_ID.
//
// Deliberately uses its own throwaway synthetic identities, NOT the real
// PARENT_CUSTOMER_ID/CHILD_CUSTOMER_ID from test-composite.mjs — reusing the
// real child here would create extra FamilyLink rows under the real parent
// with fake ChildAccountIds, which breaks Family_Composite's GetChildren
// (it iterates every linked child and blows up on any with a fake account).
// Family_Atomic never validates these against real SMUtBank accounts anyway
// (only Family_Composite does), so synthetic values work fine here — this
// script writes real rows into FamilyLink/Budget/SpendLog/SpendRequest but
// is safe to re-run.

import { assert, env, http, step, summary } from './_lib.mjs'

const BASE = env('ATOMIC_BASE')
const API_KEY = env('ATOMIC_API_KEY')
const PARENT_CUSTOMER_ID = env('ATOMIC_TEST_PARENT_ID')
const PARENT_ACCOUNT_ID = '0000000001'
const CHILD_CUSTOMER_ID = env('ATOMIC_TEST_CHILD_ID')
const MERCHANT_ACCOUNT_ID = env('ATOMIC_TEST_MERCHANT_ID')

const headers = { 'X-Contacts-Key': API_KEY }
const errs = (json) => json?.Errors?.[0] ?? ''

console.log(`\nFamily_Atomic (FamilyData) deep test\nBase: ${BASE}\n`)

// ---------------------------------------------------------------- FamilyLink

console.log('-- FamilyLink --')

await step('AddLink rejects missing ParentCustomerId/ChildCustomerId', async () => {
  const { status, json } = await http(BASE, 'POST', 'AddLink', { headers, body: { ParentCustomerId: '', ChildCustomerId: '' } })
  assert(status !== 200, `expected a non-200, got ${status}`)
  assert(/required/i.test(errs(json)), `expected a "required" validation message, got ${JSON.stringify(json)}`)
})

let familyLinkId

await step('AddLink returns an id and defaults Status to Pending', async () => {
  const { status, json } = await http(BASE, 'POST', 'AddLink', {
    headers,
    body: {
      ParentCustomerId: PARENT_CUSTOMER_ID,
      ParentAccountId: PARENT_ACCOUNT_ID,
      ChildCustomerId: CHILD_CUSTOMER_ID,
      Nickname: 'Test harness child',
      HostCurrency: 'KRW',
    },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(typeof json.id === 'number', `expected numeric id, got ${JSON.stringify(json)}`)
  familyLinkId = json.id
})

await step('GetLink returns the record with Status "Pending" and HostCurrency round-tripped', async () => {
  const { status, json } = await http(BASE, 'GET', `GetLink?FamilyLinkId=${familyLinkId}`, { headers })
  assert(status === 200, `expected 200, got ${status}`)
  assert(json.Status === 'Pending', `expected Status "Pending", got ${json.Status}`)
  assert(json.ParentCustomerId === PARENT_CUSTOMER_ID, 'ParentCustomerId did not round-trip')
  assert(json.HostCurrency === 'KRW', `expected HostCurrency KRW, got ${json.HostCurrency}`)
})

await step('GetLink on a bogus id returns "Not found: ..."', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetLink?FamilyLinkId=999999999', { headers })
  assert(status !== 200, 'expected a non-200 response for a missing record')
  assert(/^Not found:/.test(errs(json)), `expected a "Not found: ..." message, got ${JSON.stringify(json)}`)
})

await step('UpdateLink on a bogus id returns "Not found: ..."', async () => {
  const { status, json } = await http(BASE, 'PUT', 'UpdateLink', { headers, body: { Id: 999999999 } })
  assert(status !== 200, 'expected a non-200 response')
  assert(/^Not found:/.test(errs(json)), `expected "Not found: ...", got ${JSON.stringify(json)}`)
})

await step('UpdateLink changes Nickname and Status, GetLink reflects it', async () => {
  const { status, json } = await http(BASE, 'PUT', 'UpdateLink', {
    headers,
    body: {
      Id: familyLinkId,
      ParentAccountId: PARENT_ACCOUNT_ID,
      ChildAccountId: '0000000000',
      Nickname: 'Renamed in test harness',
      HostCurrency: 'KRW',
      Status: 'Active',
      StandingInstructionId: 0,
    },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(json.status === 'Updated', `expected status "Updated", got ${JSON.stringify(json)}`)

  const check = await http(BASE, 'GET', `GetLink?FamilyLinkId=${familyLinkId}`, { headers })
  assert(check.json.Nickname === 'Renamed in test harness', `Nickname did not update, got ${check.json.Nickname}`)
  assert(check.json.Status === 'Active', `Status did not update, got ${check.json.Status}`)
})

await step('GetChildren lists the link under its parent, and is empty for an unknown parent', async () => {
  const mine = await http(BASE, 'GET', `GetChildren?ParentCustomerId=${encodeURIComponent(PARENT_CUSTOMER_ID)}`, { headers })
  assert(mine.status === 200, `expected 200, got ${mine.status}`)
  assert(Array.isArray(mine.json), 'expected a list')
  assert(mine.json.some((l) => l.Id === familyLinkId), 'new link not found in GetChildren')

  const nobody = await http(BASE, 'GET', 'GetChildren?ParentCustomerId=NO_SUCH_PARENT_XYZ', { headers })
  assert(nobody.status === 200, `expected 200, got ${nobody.status}`)
  assert(Array.isArray(nobody.json) && nobody.json.length === 0, `expected an empty list, got ${JSON.stringify(nobody.json)}`)
})

await step('GetLinkByChild returns the same record (now Active), 404s for an unknown child', async () => {
  const mine = await http(BASE, 'GET', `GetLinkByChild?ChildCustomerId=${encodeURIComponent(CHILD_CUSTOMER_ID)}`, { headers })
  assert(mine.status === 200, `expected 200, got ${mine.status}`)
  assert(mine.json.Id === familyLinkId, `expected Id ${familyLinkId}, got ${mine.json.Id}`)
  assert(mine.json.Status === 'Active', `expected Status Active (set by UpdateLink above), got ${mine.json.Status}`)

  const nobody = await http(BASE, 'GET', 'GetLinkByChild?ChildCustomerId=NO_SUCH_CHILD_XYZ', { headers })
  assert(nobody.status !== 200, 'expected a non-200 response')
  assert(/^Not found:/.test(errs(nobody.json)), `expected "Not found: ...", got ${JSON.stringify(nobody.json)}`)
})

// -------------------------------------------------------------------- Budget

console.log('-- Budget --')

await step('SetBudget rejects amount <= 0 and an invalid Period', async () => {
  const bad1 = await http(BASE, 'POST', 'SetBudget', { headers, body: { FamilyLinkId: familyLinkId, Period: 'Monthly', Amount: 0 } })
  assert(bad1.status !== 200, 'expected a non-200 for Amount 0')
  const bad2 = await http(BASE, 'POST', 'SetBudget', { headers, body: { FamilyLinkId: familyLinkId, Period: 'Daily', Amount: 50 } })
  assert(bad2.status !== 200, 'expected a non-200 for an invalid Period')
})

let budgetId

await step('SetBudget creates a budget of 500/Monthly', async () => {
  const { status, json } = await http(BASE, 'POST', 'SetBudget', { headers, body: { FamilyLinkId: familyLinkId, Period: 'Monthly', Amount: 500 } })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(typeof json.id === 'number', 'expected numeric id')
  budgetId = json.id
})

await step('SetBudget again (same FamilyLinkId) upserts — same id, new amount', async () => {
  const { status, json } = await http(BASE, 'POST', 'SetBudget', { headers, body: { FamilyLinkId: familyLinkId, Period: 'Weekly', Amount: 750 } })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(json.id === budgetId, `expected upsert to reuse id ${budgetId}, got ${json.id} — check the Unique index on Budget.FamilyLinkId`)

  const check = await http(BASE, 'GET', `GetBudget?FamilyLinkId=${familyLinkId}`, { headers })
  // GetBudget's casing has drifted to lowercase while GetLink stays PascalCase
  // (Family_Atomic entities are otherwise PascalCase-as-is per Task 3.1) — tolerate both.
  const amount = check.json.Amount ?? check.json.amount
  const period = check.json.Period ?? check.json.period
  assert(Number(amount) === 750, `expected updated Amount 750, got ${JSON.stringify(check.json)}`)
  assert(period === 'Weekly', `expected updated Period Weekly, got ${JSON.stringify(check.json)}`)
})

await step('GetBudget on a FamilyLink with no budget returns "Not found: ..."', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetBudget?FamilyLinkId=999999999', { headers })
  assert(status !== 200, 'expected a non-200 response')
  assert(/^Not found:/.test(errs(json)), `expected "Not found: ...", got ${JSON.stringify(json)}`)
})

// Reset to a predictable Monthly/500 for the SpendLog/SpendRequest sections below.
await http(BASE, 'POST', 'SetBudget', { headers, body: { FamilyLinkId: familyLinkId, Period: 'Monthly', Amount: 500 } })

// ------------------------------------------------------------------ SpendLog

console.log('-- SpendLog --')

await step('AddSpend rejects amount <= 0 and FamilyLinkId 0', async () => {
  const { status } = await http(BASE, 'POST', 'AddSpend', { headers, body: { FamilyLinkId: 0, Amount: 0 } })
  assert(status !== 200, 'expected a non-200 response')
})

await step('AddSpend x2 (Food 40, Rent 120), defaulting Category/Currency where omitted', async () => {
  const a = await http(BASE, 'POST', 'AddSpend', { headers, body: { FamilyLinkId: familyLinkId, Amount: 40, Category: 'Food' } })
  assert(a.status === 200, `expected 200, got ${a.status}: ${JSON.stringify(a.json)}`)
  const b = await http(BASE, 'POST', 'AddSpend', { headers, body: { FamilyLinkId: familyLinkId, Amount: 120, Category: 'Rent' } })
  assert(b.status === 200, `expected 200, got ${b.status}: ${JSON.stringify(b.json)}`)
})

await step('AddSpend without a Category defaults to "Other"', async () => {
  const { status, json } = await http(BASE, 'POST', 'AddSpend', { headers, body: { FamilyLinkId: familyLinkId, Amount: 5 } })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  const list = await http(BASE, 'GET', `GetSpends?FamilyLinkId=${familyLinkId}&StartDate=2020-01-01T00:00:00&EndDate=2030-01-01T00:00:00`, { headers })
  const row = list.json.find((s) => s.Id === json.id)
  assert(row?.Category === 'Other', `expected default Category "Other", got ${row?.Category}`)
})

await step('GetSpends date range excludes rows outside the window', async () => {
  const narrow = await http(BASE, 'GET', `GetSpends?FamilyLinkId=${familyLinkId}&StartDate=2099-01-01T00:00:00&EndDate=2099-12-31T23:59:59`, { headers })
  assert(narrow.status === 200, `expected 200, got ${narrow.status}`)
  assert(Array.isArray(narrow.json) && narrow.json.length === 0, `expected no rows in a future window, got ${JSON.stringify(narrow.json)}`)
})

await step('GetSpendSummary totals 165 across three categories (Food, Rent, Other)', async () => {
  const start = '2020-01-01T00:00:00'
  const end = '2030-01-01T00:00:00'
  const { status, json } = await http(BASE, 'GET', `GetSpendSummary?FamilyLinkId=${familyLinkId}&StartDate=${start}&EndDate=${end}`, { headers })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  const total = Number(json.total ?? json.Total)
  assert(total === 165, `expected total 165, got ${total} — check GetSpendSummary's SQL node`)
  const cats = json.categories ?? json.Categories
  assert(Array.isArray(cats) && cats.length === 3, `expected 3 categories, got ${JSON.stringify(cats)}`)
})

// -------------------------------------------------------------- SpendRequest

console.log('-- SpendRequest --')

await step('AddRequest rejects a missing MerchantAccountId', async () => {
  const { status } = await http(BASE, 'POST', 'AddRequest', { headers, body: { FamilyLinkId: familyLinkId, Amount: 10 } })
  assert(status !== 200, 'expected a non-200 response')
})

let requestId

await step('AddRequest creates a Pending spend request', async () => {
  const { status, json } = await http(BASE, 'POST', 'AddRequest', {
    headers,
    body: { FamilyLinkId: familyLinkId, MerchantAccountId: MERCHANT_ACCOUNT_ID, Amount: 400, Category: 'Study' },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  requestId = json.id
  const check = await http(BASE, 'GET', `GetRequest?RequestId=${requestId}`, { headers })
  assert(check.json.Status === 'Pending', `expected Status Pending, got ${check.json.Status}`)
})

await step('GetRequest on a bogus id returns "Not found: ..."', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetRequest?RequestId=999999999', { headers })
  assert(status !== 200, 'expected a non-200 response')
  assert(/^Not found:/.test(errs(json)), `expected "Not found: ...", got ${JSON.stringify(json)}`)
})

await step('GetRequests filters by Status', async () => {
  const pending = await http(BASE, 'GET', `GetRequests?FamilyLinkId=${familyLinkId}&Status=Pending`, { headers })
  assert(pending.json.some((r) => r.Id === requestId), 'expected the new request in the Pending filter')
  const approved = await http(BASE, 'GET', `GetRequests?FamilyLinkId=${familyLinkId}&Status=Approved`, { headers })
  assert(!approved.json.some((r) => r.Id === requestId), 'request should not show up under Approved yet')
})

await step('UpdateRequestStatus rejects a status that is not Approved/Rejected', async () => {
  const { status } = await http(BASE, 'PUT', 'UpdateRequestStatus', { headers, body: { id: requestId, status: 'Maybe' } })
  assert(status !== 200, 'expected a non-200 response')
})

await step('UpdateRequestStatus on a bogus id returns "Not found: ..."', async () => {
  const { status, json } = await http(BASE, 'PUT', 'UpdateRequestStatus', { headers, body: { id: 999999999, status: 'Approved' } })
  assert(status !== 200, 'expected a non-200 response')
  assert(/^Not found:/.test(errs(json)), `expected "Not found: ...", got ${JSON.stringify(json)}`)
})

await step('UpdateRequestStatus approves the request', async () => {
  const { status, json } = await http(BASE, 'PUT', 'UpdateRequestStatus', { headers, body: { id: requestId, status: 'Approved' } })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(json.status === 'Approved', `expected status Approved, got ${JSON.stringify(json)}`)
})

await step('UpdateRequestStatus on an already-decided request is rejected', async () => {
  const { status, json } = await http(BASE, 'PUT', 'UpdateRequestStatus', { headers, body: { id: requestId, status: 'Approved' } })
  assert(status !== 200, 'expected a non-200 response')
  assert(/pending/i.test(errs(json)), `expected a "pending" validation message, got ${JSON.stringify(json)}`)
})

// --------------------------------------------------------------------- Auth

console.log('-- Auth --')

await step('Missing API key is rejected on a GET', async () => {
  const { status, json } = await http(BASE, 'GET', `GetLink?FamilyLinkId=${familyLinkId}`, {})
  assert(status !== 200, 'expected a non-200 response without the API key')
  assert(/Invalid API Key/i.test(errs(json)), `expected "Invalid API Key", got ${JSON.stringify(json)}`)
})

await step('Wrong API key is rejected', async () => {
  const { status, json } = await http(BASE, 'GET', `GetLink?FamilyLinkId=${familyLinkId}`, { headers: { 'X-Contacts-Key': 'not-the-real-key' } })
  assert(status !== 200, 'expected a non-200 response with a bad key')
  assert(/Invalid API Key/i.test(errs(json)), `expected "Invalid API Key", got ${JSON.stringify(json)}`)
})

await step('Missing API key is rejected on a POST too', async () => {
  const { status, json } = await http(BASE, 'POST', 'AddSpend', { body: { FamilyLinkId: familyLinkId, Amount: 1 } })
  assert(status !== 200, 'expected a non-200 response without the API key')
  assert(/Invalid API Key/i.test(errs(json)), `expected "Invalid API Key", got ${JSON.stringify(json)}`)
})

summary()
