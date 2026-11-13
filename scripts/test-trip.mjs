// Live contract test for WeTrip_Trip_Composite (PlanTrip, GetTripOverview,
// PayOnTrip, PayLaterOnTrip, AddReceipt, GetReceipt, GetMyMiles, CloseTrip, fixed costs) plus the real FX forward booked by SmartFX LockNow.
//
//   bun --env-file=.env.local scripts/test-trip.mjs
//
// WARNING: this MOVES SANDBOX MONEY. One PayOnTrip sends about 1 SGD (plus the
// bank's fee) from the demo child's SGD account to merchant M001, and LockNow
// books a real FX forward contract (no money moves at booking in this sandbox).
// PayLaterOnTrip has the BNPL pool pay the merchant about JPY 2600 and sets up a
// 3-month standing instruction on the demo child's JPY wallet (it must exist and
// cover the first instalment, or that step fails with the server's message).
// Run it only against the demo accounts, one run at a time, by hand.
//
// Each run plans its own trip ("Trip harness <time>") with auto-lock off, so it
// never touches the demo trip, and closes it at the end.

import { assert, env, field, http, step, summary } from './_lib.mjs'

const ORIGIN = 'https://smuedu-dev.outsystemsenterprise.com'
const TRIP = `${ORIGIN}/WeTrip_Trip_Composite/rest/Trip`
const SMARTFX = `${ORIGIN}/WeTrip_SmartFX_Composite/rest/SmartFX`
const BUDGET = `${ORIGIN}/WeTrip_Budget_Composite/rest/BudgetComposite`
const KEY = env('WETRIP_SERVER_KEY')
const FX_KEY = KEY
const PARENT = `${env('PARENT_CUSTOMER_ID', '0000002169')}:${env('PARENT_ACCOUNT_ID', '0000004554')}:TripHarness`
const CHILD = `${env('CHILD_CUSTOMER_ID', '0000002828')}:${env('CHILD_ACCOUNT_ID', '0000006064')}:TripHarness`
const STRANGER = '0000009999:0000009999:Stranger'
const FAMILY_LINK_ID = Number(env('FAMILY_LINK_ID', '3'))
const MERCHANT = env('TRIP_MERCHANT_CODE', 'M001')
const PAY_JPY = 120 // about 1 SGD
const LATER_JPY = 2600 // over the SGD 20 pay-later minimum
const FOOD = 6
const RECEIPT_JPY = 1200
// A 1x1 PNG, enough to prove the photo round-trips.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const ACCOMMODATION = 3
const OTHERS = 4
const FIXED_SOURCE = 5

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
const as = (token) => (method, path, body) =>
  http(TRIP, method, path, { headers: { 'X-Contacts-Key': KEY, 'X-Session-Token': token }, body })
const parent = as(PARENT)
const child = as(CHILD)
const refused = (r) => r.status >= 400 && JSON.stringify(r.json)
// Miles rule (#32): floor(round2(sgdCharged) x 10), worked in whole cents so a float
// like 0.97 x 10 cannot land just under the integer.
const milesFor = (sgd) => Math.floor(Math.round(Number(sgd) * 100) / 10)
const myMiles = async () => {
  const r = await child('GET', 'GetMyMiles')
  assert(r.status === 200, `GetMyMiles: expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  return Number(field(r.json, 'balance'))
}
const firstError = (r) => (r.json.Errors ?? r.json.errors)?.[0]
const dashboardAs = (token) =>
  http(BUDGET, 'GET', `GetDashboard?TripId=${field(trip, 'id')}`, {
    headers: { 'X-Contacts-Key': KEY, 'X-Session-Token': token },
  })
const dashboard = (tripId) =>
  http(BUDGET, 'GET', `GetDashboard?TripId=${tripId}`, {
    headers: { 'X-Contacts-Key': KEY, 'X-Session-Token': PARENT },
  })
const fixedCost = (over = {}) => ({
  TripId: field(trip, 'id'),
  Name: 'Rail pass',
  CategoryId: OTHERS,
  AmountSgd: 1,
  RequestId: `harness-${Date.now()}-fixed`,
  ...over,
})

console.log(`\nTrip composite live test\nBase: ${TRIP}\n`)
let trip
let requestId
let paidForeign = 0
let milesBefore = 0
let milesEarned = 0
let receiptRequestId
let lockedRate
let receiptId
let laterRequestId

await step('PlanTrip as the child is refused', async () => {
  const r = await child('POST', 'PlanTrip', planBody())
  assert(refused(r), `expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
})

await step('PlanTrip refuses bad fixed costs before creating anything', async () => {
  const hotel = { Name: 'Hotel', CategoryId: ACCOMMODATION, AmountSgd: 3 }
  const trips = async () =>
    (
      await http(
        SMARTFX,
        'GET',
        `GetTrips?${new URLSearchParams({ apiKey: FX_KEY, sessionToken: PARENT, familyLinkId: FAMILY_LINK_ID })}`,
      )
    ).json
  const before = (await trips()).length
  const bad = {
    'empty name': [{ ...hotel, Name: '' }],
    'name over 40 characters': [{ ...hotel, Name: 'x'.repeat(41) }],
    'amount of 0': [{ ...hotel, AmountSgd: 0 }],
    'unknown category': [{ ...hotel, CategoryId: 99 }],
    'more than 10 rows': Array.from({ length: 11 }, () => hotel),
  }
  for (const [what, FixedCosts] of Object.entries(bad)) {
    const r = await parent('POST', 'PlanTrip', planBody({ FixedCosts }))
    assert(refused(r), `${what}: expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
  }
  assert((await trips()).length === before, 'a refused PlanTrip still created a trip')
})

await step(
  'PlanTrip as the parent opens a wallet, creates the trip, sets the budget and a fixed cost',
  async () => {
    const r = await parent(
      'POST',
      'PlanTrip',
      planBody({
        Budgets: [
          { CategoryId: FOOD, LimitAmount: 15 },
          { CategoryId: ACCOMMODATION, LimitAmount: 4 },
        ],
        FixedCosts: [{ Name: 'Hotel', CategoryId: ACCOMMODATION, AmountSgd: 3 }],
      }),
    )
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
    trip = r.json
    assert(
      !field(trip, 'fixedCostsFailed'),
      `fixed cost failed: ${field(trip, 'fixedCostsFailed')}`,
    )
    assert(field(trip, 'id') > 0, 'no trip id')
    assert(field(trip, 'foreignAccountId'), 'no foreign wallet')
    assert(field(trip, 'parentAccountId'), 'ParentAccountId not taken from the family link')
    assert(field(trip, 'childCustomerId'), 'ChildCustomerId not taken from the family link')
    console.log(`      trip ${field(trip, 'id')}`)
  },
)

await step('GetTripOverview: the parent sees the trip and its SGD budget', async () => {
  const r = await parent('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'callerRole') === 'Parent', 'callerRole should be Parent')
  assert(field(r.json, 'hasBudget') === true, 'budget missing')
  const food = (field(field(r.json, 'budget'), 'lines') || []).find(
    (l) => field(l, 'categoryId') === FOOD,
  )
  assert(
    food && Number(field(food, 'limitAmount')) === 15,
    `Food limit wrong: ${JSON.stringify(food)}`,
  )
})

await step('GetTripOverview: another customer is refused', async () => {
  const r = await as(STRANGER)('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('the fixed cost is one SourceId 5 expense in Accommodation', async () => {
  const r = await dashboard(field(trip, 'id'))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  const fixed = (field(r.json, 'expenses') || []).filter(
    (e) => Number(field(e, 'sourceId')) === FIXED_SOURCE,
  )
  assert(fixed.length === 1, `expected 1 fixed expense, got ${JSON.stringify(fixed)}`)
  assert(field(fixed[0], 'merchantName') === 'Hotel', 'MerchantName should be the cost name')
  assert(Number(field(fixed[0], 'amount')) === 3, `amount ${field(fixed[0], 'amount')}`)
  assert(Number(field(fixed[0], 'categoryId')) === ACCOMMODATION, 'wrong category')
  const o = await parent('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  assert(Number(field(field(o.json, 'budget'), 'fixedSgd')) === 3, 'Budget.FixedSgd should be 3')
})

await step(
  'AddFixedCost: the parent adds one and a repeat of its RequestId is a no-op',
  async () => {
    const body = fixedCost()
    for (let i = 0; i < 2; i++) {
      const r = await parent('POST', 'AddFixedCost', body)
      assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
    }
    const d = await dashboard(field(trip, 'id'))
    const rail = (field(d.json, 'expenses') || []).filter(
      (e) => field(e, 'merchantName') === 'Rail pass',
    )
    assert(rail.length === 1, `expected 1 Rail pass expense, got ${rail.length}`)
  },
)

await step('AddFixedCost as the child, or with an amount of 0, is refused', async () => {
  const asChild = await child(
    'POST',
    'AddFixedCost',
    fixedCost({ RequestId: `harness-${Date.now()}-c` }),
  )
  assert(refused(asChild), `child: expected a refusal, got ${asChild.status}`)
  const zero = await parent(
    'POST',
    'AddFixedCost',
    fixedCost({ AmountSgd: 0, RequestId: `harness-${Date.now()}-z` }),
  )
  assert(refused(zero), `amount 0: expected a refusal, got ${zero.status}`)
})

await step('PayOnTrip before anything is locked is refused', async () => {
  const r = await child('POST', 'PayOnTrip', payBody(`harness-${Date.now()}-early`, PAY_JPY))
  assert(refused(r), `expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
})

await step(
  'AddReceipt in JPY before anything is locked is refused with the lock message',
  async () => {
    const r = await child(
      'POST',
      'AddReceipt',
      receiptBody(`harness-${Date.now()}-nolock`, 'JPY', 100),
    )
    assert(refused(r), `expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
    assert(
      firstError(r) === 'Lock a rate first so we can convert this receipt',
      `wrong message: ${firstError(r)}`,
    )
  },
)

await step('AddReceipt in SGD needs no lock and no conversion', async () => {
  const r = await child('POST', 'AddReceipt', receiptBody(`harness-${Date.now()}-sgd`, 'SGD', 1))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'expenseId') > 0, 'no expense id')
  assert(Number(field(r.json, 'amountSgd')) === 1, `amountSgd ${field(r.json, 'amountSgd')}`)
})

await step('LockNow books a real FX forward and records its id', async () => {
  const q = new URLSearchParams({ apiKey: FX_KEY, sessionToken: PARENT })
  const r = await http(SMARTFX, 'POST', `LockNow?${q}`, {
    body: { tripId: field(trip, 'id'), sgdAmount: 10, period: '3M' },
  })
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  const lock = r.json.Lock || r.json.lock
  assert(lock?.FxForwardId, `no FxForwardId on the lock: ${JSON.stringify(lock)}`)
  console.log(`      forward ${lock.FxForwardId} (${lock.ReferenceNumber})`)
})

await step('PayOnTrip as the parent is refused', async () => {
  const r = await parent('POST', 'PayOnTrip', payBody(`harness-${Date.now()}-parent`, PAY_JPY))
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('GetMyMiles: the child reads a starting balance', async () => {
  milesBefore = await myMiles()
  assert(Number.isInteger(milesBefore) && milesBefore >= 0, `bad balance ${milesBefore}`)
})

await step(`PayOnTrip as the child pays ${PAY_JPY} JPY once, at the locked rate`, async () => {
  requestId = `harness-${Date.now()}`
  const r = await child('POST', 'PayOnTrip', payBody(requestId, PAY_JPY))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'status') === 'Paid', `expected Paid, got ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'transactionId'), 'no bank transaction id')
  assert(Number(field(r.json, 'sgdCharged')) > 0, 'nothing charged')
  paidForeign = PAY_JPY
  milesEarned = Number(field(r.json, 'milesEarned'))
  assert(
    milesEarned === milesFor(field(r.json, 'sgdCharged')),
    `milesEarned ${milesEarned}, expected ${milesFor(field(r.json, 'sgdCharged'))} for SGD ${field(r.json, 'sgdCharged')}`,
  )
  console.log(
    `      charged SGD ${field(r.json, 'sgdCharged')}, ledger pending: ${field(r.json, 'ledgerPending')}`,
  )
})

await step('GetMyMiles: the balance grew by exactly the miles earned', async () => {
  const now = await myMiles()
  assert(now === milesBefore + milesEarned, `balance ${now}, expected ${milesBefore + milesEarned}`)
})

await step('PayOnTrip with the same requestId is a no-op', async () => {
  const r = await child('POST', 'PayOnTrip', payBody(requestId, PAY_JPY))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(
    field(r.json, 'status') === 'Duplicate',
    `expected Duplicate, got ${JSON.stringify(r.json)}`,
  )
  assert(Number(field(r.json, 'milesEarned')) === 0, 'a Duplicate must earn 0 miles')
  const now = await myMiles()
  assert(now === milesBefore + milesEarned, `Duplicate moved the balance to ${now}`)
})

await step('PayOnTrip for more than the pot holds is declined without paying', async () => {
  const r = await child('POST', 'PayOnTrip', payBody(`harness-${Date.now()}-big`, 10_000_000))
  assert(field(r.json, 'status') === 'Declined', `expected Declined, got ${JSON.stringify(r.json)}`)
  assert(Number(field(r.json, 'milesEarned') || 0) === 0, 'a Declined must earn 0 miles')
  const now = await myMiles()
  assert(now === milesBefore + milesEarned, `Declined moved the balance to ${now}`)
})

await step('the overview shows the spend, the pot left and the budget expense', async () => {
  const r = await child('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  assert(r.status === 200, `expected 200, got ${r.status}`)
  assert(
    Number(field(r.json, 'spentForeign')) === paidForeign,
    `spent ${field(r.json, 'spentForeign')}`,
  )
  const spends = field(r.json, 'spends') || []
  assert(
    spends.some((s) => field(s, 'requestId') === requestId),
    'spend not recorded with its requestId',
  )
  const food = (field(field(r.json, 'budget'), 'lines') || []).find(
    (l) => field(l, 'categoryId') === FOOD,
  )
  assert(Number(field(food, 'spentAmount')) > 0, 'budget expense not recorded')
  assert(
    Number(field(r.json, 'milesEarned')) === milesEarned,
    `overview milesEarned ${field(r.json, 'milesEarned')}, expected ${milesEarned}`,
  )
})

await step('PayLaterOnTrip as the parent, or for 4 months, is refused', async () => {
  const p = await parent('POST', 'PayLaterOnTrip', laterBody(`harness-${Date.now()}-lp`, 3))
  assert(refused(p), `parent: expected a refusal, got ${p.status}`)
  const c = await child('POST', 'PayLaterOnTrip', laterBody(`harness-${Date.now()}-l4`, 4))
  assert(refused(c), `4 months: expected a refusal, got ${c.status}`)
  assert(firstError(c) === 'Choose 3, 6 or 12 months', `wrong message: ${firstError(c)}`)
})

await step(`PayLaterOnTrip as the child spreads JPY ${LATER_JPY} over 3 months`, async () => {
  const before = await child('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  laterRequestId = `harness-${Date.now()}-later`
  const r = await child('POST', 'PayLaterOnTrip', laterBody(laterRequestId, 3))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'status') === 'Paid', `expected Paid, got ${JSON.stringify(r.json)}`)
  assert(Number(field(r.json, 'principal')) === LATER_JPY, 'wrong principal')
  assert(Number(field(r.json, 'monthlyInstallment')) > 0, 'no instalment')
  assert(field(r.json, 'firstRepaymentDate'), 'no first repayment date')
  assert(!field(r.json, 'ledgerPending'), `ledger pending: ${field(r.json, 'message')}`)
  const rate = Number(field(before.json, 'lockedRate'))
  const sgd = Math.round((LATER_JPY / rate) * 100) / 100
  assert(
    Math.abs(Number(field(r.json, 'sgdBudgeted')) - sgd) <= 0.01,
    `budgeted ${field(r.json, 'sgdBudgeted')}, expected ${sgd}`,
  )
  const after = await child('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  assert(
    Number(field(after.json, 'remainingForeign')) ===
      Number(field(before.json, 'remainingForeign')),
    'pay later changed the trip pot',
  )
  console.log(
    `      3 x JPY ${field(r.json, 'monthlyInstallment')}, interest JPY ${field(r.json, 'totalInterest')}, SGD ${sgd} budgeted`,
  )
})

await step('PayLaterOnTrip with the same requestId is a no-op: one plan, one expense', async () => {
  const r = await child('POST', 'PayLaterOnTrip', laterBody(laterRequestId, 3))
  assert(
    field(r.json, 'status') === 'Duplicate',
    `expected Duplicate, got ${JSON.stringify(r.json)}`,
  )
  const rows = (field((await dashboardAs(CHILD)).json, 'expenses') || []).filter(
    (e) => field(e, 'sourceId') === 2 && String(field(e, 'description')).includes('pay later'),
  )
  assert(rows.length === 1, `expected one pay-later expense, got ${rows.length}`)
  assert(field(rows[0], 'categoryId') === FOOD, `categoryId ${field(rows[0], 'categoryId')}`)
  const o = await parent('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  const plans = field(o.json, 'bnplPlans') || []
  assert(plans.length === 1, `expected one plan on the overview, got ${plans.length}`)
})

await step('AddReceipt as the parent is refused', async () => {
  const r = await parent('POST', 'AddReceipt', receiptBody(`harness-${Date.now()}-p`, 'JPY', 100))
  assert(refused(r), `expected a refusal, got ${r.status}`)
  assert(firstError(r) === 'Only the child can add a receipt', `wrong message: ${firstError(r)}`)
})

await step('AddReceipt from outside the family is refused', async () => {
  const r = await as(STRANGER)(
    'POST',
    'AddReceipt',
    receiptBody(`harness-${Date.now()}-s`, 'JPY', 100),
  )
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('AddReceipt with a bad amount, category, currency or image is refused', async () => {
  const bad = [
    receiptBody(`harness-${Date.now()}-a`, 'JPY', 0),
    { ...receiptBody(`harness-${Date.now()}-c`, 'JPY', 100), CategoryId: 999 },
    receiptBody(`harness-${Date.now()}-u`, 'USD', 100),
    { ...receiptBody(`harness-${Date.now()}-t`, 'JPY', 100), ContentType: 'image/gif' },
    {
      ...receiptBody(`harness-${Date.now()}-b`, 'JPY', 100),
      ImageBase64: Buffer.alloc(1_100_000).toString('base64'),
    },
  ]
  for (const body of bad) {
    const r = await child('POST', 'AddReceipt', body)
    assert(refused(r), `expected a refusal for ${body.RequestId}, got ${r.status}`)
  }
})

await step(`AddReceipt as the child records JPY ${RECEIPT_JPY} at the locked rate`, async () => {
  const o = await child('GET', `GetTripOverview?TripId=${field(trip, 'id')}`)
  lockedRate = Number(field(o.json, 'lockedRate'))
  assert(lockedRate > 0, 'no locked rate')
  receiptRequestId = `harness-${Date.now()}-receipt`
  const r = await child('POST', 'AddReceipt', receiptBody(receiptRequestId, 'JPY', RECEIPT_JPY))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(r.json, 'expenseId') > 0, 'no expense id')
  assert(
    Math.abs(Number(field(r.json, 'amountSgd')) - RECEIPT_JPY / lockedRate) < 0.01,
    `amountSgd ${field(r.json, 'amountSgd')}, expected ${RECEIPT_JPY / lockedRate}`,
  )
})

await step('AddReceipt with the same requestId is a no-op: still one expense', async () => {
  const r = await child('POST', 'AddReceipt', receiptBody(receiptRequestId, 'JPY', RECEIPT_JPY))
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  const rows = receiptExpenses(await dashboardAs(CHILD))
  assert(rows.length === 1, `expected one receipt expense, got ${rows.length}`)
})

await step('the budget shows the receipt as a Food expense with its photo', async () => {
  const [row] = receiptExpenses(await dashboardAs(PARENT))
  assert(row, 'receipt expense missing from the parent dashboard')
  assert(field(row, 'sourceId') === 3, `sourceId ${field(row, 'sourceId')}`)
  assert(field(row, 'categoryId') === FOOD, `categoryId ${field(row, 'categoryId')}`)
  assert(field(row, 'merchantName') === 'Cash receipt', `merchant ${field(row, 'merchantName')}`)
  assert(field(row, 'receiptId') > 0, 'no receiptId on the expense')
  receiptId = field(row, 'receiptId')
})

await step('GetReceipt returns the photo to the family and refuses a stranger', async () => {
  for (const who of [child, parent]) {
    const r = await who('GET', `GetReceipt?ReceiptId=${receiptId}`)
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
    assert(field(r.json, 'contentType') === 'image/png', 'wrong contentType')
    assert(field(r.json, 'imageBase64') === TINY_PNG, 'photo changed in storage')
  }
  const r = await as(STRANGER)('GET', `GetReceipt?ReceiptId=${receiptId}`)
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('CloseTrip as the child is refused', async () => {
  const r = await child('POST', `CloseTrip?TripId=${field(trip, 'id')}`)
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('CloseTrip as the parent values the unspent pot at the spot rate', async () => {
  const r = await parent('POST', `CloseTrip?TripId=${field(trip, 'id')}`)
  assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
  assert(field(field(r.json, 'trip'), 'status') === 'Completed', 'trip not Completed')
  assert(Number(field(r.json, 'spotRate')) > 0, 'no spot rate')
  console.log(
    `      unspent ${field(r.json, 'returnedForeign')} JPY, saved vs spot SGD ${field(r.json, 'savedVsSpotSgd')}`,
  )
})

await step('AddReceipt on a closed trip is refused', async () => {
  const r = await child('POST', 'AddReceipt', receiptBody(`harness-${Date.now()}-late`, 'JPY', 100))
  assert(refused(r), `expected a refusal, got ${r.status}`)
  assert(firstError(r) === 'This trip has ended', `wrong message: ${firstError(r)}`)
})

await step('closing twice is refused', async () => {
  const r = await parent('POST', `CloseTrip?TripId=${field(trip, 'id')}`)
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

await step('AddFixedCost on a closed trip is refused', async () => {
  const r = await parent(
    'POST',
    'AddFixedCost',
    fixedCost({ RequestId: `harness-${Date.now()}-closed` }),
  )
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

summary()

function planBody(extra = {}) {
  return {
    FamilyLinkId: FAMILY_LINK_ID,
    Destination: `Trip harness ${new Date().toISOString().slice(0, 16)}`,
    Currency: 'JPY',
    TripStartDate: day(40),
    TripEndDate: day(45),
    TargetBudgetSgd: 20,
    TargetRate: 1,
    AutoLockEnabled: false,
    Budgets: [{ CategoryId: FOOD, LimitAmount: 15 }],
    ...extra,
  }
}

function receiptBody(id, currency, amount) {
  return {
    TripId: field(trip, 'id'),
    Amount: amount,
    Currency: currency,
    CategoryId: FOOD,
    RequestId: id,
    ImageBase64: TINY_PNG,
    ContentType: 'image/png',
  }
}

// The expense the JPY receipt wrote (the SGD one has its own description).
function receiptExpenses(r) {
  return (field(r.json, 'expenses') || []).filter(
    (e) => field(e, 'description') === `Cash receipt · JPY ${RECEIPT_JPY}.00`,
  )
}

function payBody(id, amount) {
  return {
    TripId: field(trip, 'id'),
    MerchantCode: MERCHANT,
    Amount: amount,
    CategoryId: FOOD,
    RequestId: id,
    Narrative: 'harness',
  }
}

function laterBody(id, months) {
  return {
    TripId: field(trip, 'id'),
    MerchantCode: MERCHANT,
    Amount: LATER_JPY,
    NumberOfMonths: months,
    CategoryId: FOOD,
    RequestId: id,
  }
}
