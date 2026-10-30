// Smoke test for Family_Composite's Family REST API — the same sequence as
// the build guide's Task 20.3 Postman table, run directly against OutSystems.
//
// Usage:
//   node --env-file=.env.test scripts/test-composite.mjs
//
// WARNING: unlike test-atomic.mjs, this one calls real SMUtBank endpoints
// through Family_Composite — TopUp, SetupAllowance and ChildSpend move real
// (sandbox) money between the parent/child demo accounts and create a real
// standing instruction. Only run it against demo accounts you're happy to
// mutate. It assumes ValidateSessionStub (Task 12.4 Option C) is still wired
// up — stub tokens are "<customerId>:<accountId>:<name>".
//
// It's written to be safe to re-run: if the demo child is already linked, it
// skips LinkChild/AcceptLink and reuses the existing familyLinkId.
//
// Uses field(json, 'camelName') everywhere a response field is read, which
// tolerates structures where the Name-in-JSON fix hasn't landed yet
// (reads either the spec'd camelCase or the as-built PascalCase) — that way
// a casing gap on one structure doesn't block testing everything downstream
// of it. The casing itself is still worth fixing; see the structure table
// in Task 11.3 of the build guide.

import { assert, env, field, http, step, summary } from './_lib.mjs'

const BASE = env('COMPOSITE_BASE')
const API_KEY = env('COMPOSITE_API_KEY')

const PARENT_CUSTOMER_ID = env('PARENT_CUSTOMER_ID')
const PARENT_ACCOUNT_ID = env('PARENT_ACCOUNT_ID')
const CHILD_CUSTOMER_ID = env('CHILD_CUSTOMER_ID')
const CHILD_ACCOUNT_ID = env('CHILD_ACCOUNT_ID')
const CHILD_COUNTRY_CODE = env('CHILD_COUNTRY_CODE', '65')
const CHILD_PHONE_NUMBER = env('CHILD_PHONE_NUMBER')
const MERCHANT_ACCOUNT_ID = env('MERCHANT_ACCOUNT_ID')
const WEEKLY_MONTHLY = env('WEEKLY_MONTHLY', 'Monthly') // guess — confirm against the Payments Swagger field description

const parentToken = `${PARENT_CUSTOMER_ID}:${PARENT_ACCOUNT_ID}:ParentHarness`
const childToken = `${CHILD_CUSTOMER_ID}:${CHILD_ACCOUNT_ID}:ChildHarness`

function headersFor(token) {
  return { 'X-Contacts-Key': API_KEY, 'X-Session-Token': token }
}

console.log(`\nFamily_Composite (Family) smoke test\nBase: ${BASE}\n`)

await step('GetMyFamilyRole (parent) responds', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetMyFamilyRole', { headers: headersFor(parentToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  console.log(`      role: ${field(json, 'role')}`)
})

await step('FindCustomerByPhone finds the child', async () => {
  const { status, json } = await http(
    BASE,
    'GET',
    `FindCustomerByPhone?countryCode=${encodeURIComponent(CHILD_COUNTRY_CODE)}&phoneNumber=${encodeURIComponent(CHILD_PHONE_NUMBER)}`,
    { headers: headersFor(parentToken) },
  )
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'customerId') === CHILD_CUSTOMER_ID, `expected customerId ${CHILD_CUSTOMER_ID}, got ${JSON.stringify(json)}`)
})

let familyLinkId

await step('LinkChild (or reuse an existing link)', async () => {
  const { status, json } = await http(BASE, 'POST', 'LinkChild', {
    headers: headersFor(parentToken),
    body: { childCustomerId: CHILD_CUSTOMER_ID, nickname: 'Test harness child', hostCurrency: 'KRW' },
  })
  if (status === 200) {
    familyLinkId = field(json, 'id')
    return
  }
  // Already linked — fall through to GetChildren below to find it.
  console.log(`      LinkChild responded ${status} (${json?.Errors?.[0] ?? 'likely already linked'}), reusing existing link`)
})

if (!familyLinkId) {
  await step('Resolve familyLinkId via GetChildren', async () => {
    const { status, json } = await http(BASE, 'GET', 'GetChildren', { headers: headersFor(parentToken) })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    const match = json.find((c) => field(c, 'childCustomerId') === CHILD_CUSTOMER_ID)
    assert(match, `no existing link found for child ${CHILD_CUSTOMER_ID} — check LinkChild error above`)
    familyLinkId = field(match, 'familyLinkId')
  })
}

await step('GetMyLinkInvite (child) + AcceptLink if still pending', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetMyLinkInvite', { headers: headersFor(childToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  if (!field(json, 'hasInvite')) {
    console.log('      already active (or hasInvite missing from response), nothing to accept')
    return
  }
  const accept = await http(BASE, 'POST', 'AcceptLink', {
    headers: headersFor(childToken),
    body: { familyLinkId, accountId: CHILD_ACCOUNT_ID },
  })
  assert(accept.status === 200, `AcceptLink failed: ${accept.status} ${JSON.stringify(accept.json)}`)
  assert(field(accept.json, 'status') === 'Active', `expected status Active, got ${JSON.stringify(accept.json)}`)
})

await step('SetBudget (parent) sets 500/Monthly', async () => {
  const { status, json } = await http(BASE, 'POST', 'SetBudget', {
    headers: headersFor(parentToken),
    body: { familyLinkId, period: 'Monthly', amount: 500 },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
})

await step('TopUp (parent) moves 300 into the child account', async () => {
  const { status, json } = await http(BASE, 'POST', 'TopUp', {
    headers: headersFor(parentToken),
    body: { familyLinkId, amount: 300, narrative: 'test harness top-up' },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'transactionId'), `expected a transactionId, got ${JSON.stringify(json)}`)
})

await step('SetupAllowance (parent) — may fail if WEEKLY_MONTHLY value is wrong', async () => {
  const tomorrow = new Date(Date.now() + 86400000).toISOString()
  const { status, json } = await http(BASE, 'POST', 'SetupAllowance', {
    headers: headersFor(parentToken),
    body: { familyLinkId, amount: 100, weeklyMonthly: WEEKLY_MONTHLY, startDate: tomorrow },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)} — try a different WEEKLY_MONTHLY value in .env.test`)
  assert(field(json, 'standingInstructionId'), `expected a standingInstructionId, got ${JSON.stringify(json)}`)
})

await step('GetChildDashboard (child) shows the budget', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetChildDashboard', { headers: headersFor(childToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'hasBudget') === true, `expected hasBudget true, got ${JSON.stringify(json)}`)
})

await step('ChildSpend within budget completes immediately (40, Food)', async () => {
  const { status, json } = await http(BASE, 'POST', 'ChildSpend', {
    headers: headersFor(childToken),
    body: { merchantAccountId: MERCHANT_ACCOUNT_ID, amount: 40, category: 'Food', narrative: 'Lunch' },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'status') === 'Completed', `expected Completed, got ${JSON.stringify(json)}`)
})

await step('ChildSpend within budget completes immediately (120, Rent)', async () => {
  const { status, json } = await http(BASE, 'POST', 'ChildSpend', {
    headers: headersFor(childToken),
    body: { merchantAccountId: MERCHANT_ACCOUNT_ID, amount: 120, category: 'Rent' },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'status') === 'Completed', `expected Completed, got ${JSON.stringify(json)}`)
})

let requestId

await step('ChildSpend over budget creates a PendingApproval request (400, Study)', async () => {
  const { status, json } = await http(BASE, 'POST', 'ChildSpend', {
    headers: headersFor(childToken),
    body: { merchantAccountId: MERCHANT_ACCOUNT_ID, amount: 400, category: 'Study' },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'status') === 'PendingApproval', `expected PendingApproval, got ${JSON.stringify(json)}`)
  requestId = field(json, 'requestId')
})

await step('GetPendingRequests (parent) lists the request', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetPendingRequests', { headers: headersFor(parentToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(json.some((r) => field(r, 'requestId') === requestId), `requestId ${requestId} not found in pending list: ${JSON.stringify(json)}`)
})

await step('DecideRequest (parent) approves it', async () => {
  const { status, json } = await http(BASE, 'POST', 'DecideRequest', {
    headers: headersFor(parentToken),
    body: { requestId, approve: true },
  })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(field(json, 'status') === 'Approved', `expected Approved, got ${JSON.stringify(json)}`)
})

await step('GetChildExpenses (parent) returns rows with categories', async () => {
  const { status, json } = await http(
    BASE,
    'GET',
    `GetChildExpenses?familyLinkId=${familyLinkId}&startDate=2020-01-01&endDate=2030-01-01`,
    { headers: headersFor(parentToken) },
  )
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(Array.isArray(field(json, 'expenses')), `expected an expenses array, got ${JSON.stringify(json)}`)
})

await step('GetChildren (parent) shows the child card', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetChildren', { headers: headersFor(parentToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(json.some((c) => field(c, 'familyLinkId') === familyLinkId), `child card not found: ${JSON.stringify(json)}`)
})

await step('GetBalanceTrend (parent) returns a list', async () => {
  const { status, json } = await http(BASE, 'GET', `GetBalanceTrend?familyLinkId=${familyLinkId}&months=6`, { headers: headersFor(parentToken) })
  assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
  assert(Array.isArray(json), `expected a list, got ${JSON.stringify(json)}`)
})

// --- Negative tests ---

await step('Missing API key is rejected', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetMyFamilyRole', { headers: { 'X-Session-Token': parentToken } })
  assert(status !== 200, 'expected a non-200 response without the API key')
  assert(/Invalid API Key/i.test(json?.Errors?.[0] ?? ''), `expected "Invalid API Key", got ${JSON.stringify(json)}`)
})

await step('Missing session token is rejected', async () => {
  const { status, json } = await http(BASE, 'GET', 'GetMyFamilyRole', { headers: { 'X-Contacts-Key': API_KEY } })
  assert(status !== 200, 'expected a non-200 response without a session token')
  assert(/log in to WeTrip/i.test(json?.Errors?.[0] ?? ''), `expected "Please log in to WeTrip first", got ${JSON.stringify(json)}`)
})

await step('Child token on DecideRequest is forbidden', async () => {
  const { status, json } = await http(BASE, 'POST', 'DecideRequest', {
    headers: headersFor(childToken),
    body: { requestId, approve: true },
  })
  assert(status !== 200, 'expected a non-200 response')
  console.log(`      got: ${json?.Errors?.[0] ?? JSON.stringify(json)}`)
})

await step('Amount 0 on TopUp is rejected with a validation message', async () => {
  const { status, json } = await http(BASE, 'POST', 'TopUp', {
    headers: headersFor(parentToken),
    body: { familyLinkId, amount: 0 },
  })
  assert(status !== 200, 'expected a non-200 response')
  assert(/more than 0/i.test(json?.Errors?.[0] ?? ''), `expected a "more than 0" validation message, got ${JSON.stringify(json)}`)
})

summary()
