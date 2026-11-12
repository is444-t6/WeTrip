// Live contract test for WeTrip_Trip_Composite (PlanTrip, GetTripOverview,
// PayOnTrip, GetMyMiles, CloseTrip) plus the real FX forward booked by SmartFX LockNow.
//
//   bun --env-file=.env.local scripts/test-trip.mjs
//
// WARNING: this MOVES SANDBOX MONEY. One PayOnTrip sends about 1 SGD (plus the
// bank's fee) from the demo child's SGD account to merchant M001, and LockNow
// books a real FX forward contract (no money moves at booking in this sandbox).
// Run it only against the demo accounts, one run at a time, by hand.
//
// Each run plans its own trip ("Trip harness <time>") with auto-lock off, so it
// never touches the demo trip, and closes it at the end.

import { assert, env, field, http, step, summary } from './_lib.mjs'

const ORIGIN = 'https://smuedu-dev.outsystemsenterprise.com'
const TRIP = `${ORIGIN}/WeTrip_Trip_Composite/rest/Trip`
const SMARTFX = `${ORIGIN}/WeTrip_SmartFX_Composite/rest/SmartFX`
const KEY = env('WETRIP_SERVER_KEY')
const FX_KEY = KEY
const PARENT = `${env('PARENT_CUSTOMER_ID', '0000002169')}:${env('PARENT_ACCOUNT_ID', '0000004554')}:TripHarness`
const CHILD = `${env('CHILD_CUSTOMER_ID', '0000002828')}:${env('CHILD_ACCOUNT_ID', '0000006064')}:TripHarness`
const STRANGER = '0000009999:0000009999:Stranger'
const FAMILY_LINK_ID = Number(env('FAMILY_LINK_ID', '3'))
const MERCHANT = env('TRIP_MERCHANT_CODE', 'M001')
const PAY_JPY = 120 // about 1 SGD
const FOOD = 6

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

console.log(`\nTrip composite live test\nBase: ${TRIP}\n`)
let trip
let requestId
let paidForeign = 0
let milesBefore = 0
let milesEarned = 0

await step('PlanTrip as the child is refused', async () => {
  const r = await child('POST', 'PlanTrip', planBody())
  assert(refused(r), `expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
})

await step(
  'PlanTrip as the parent opens a wallet, creates the trip and sets the budget',
  async () => {
    const r = await parent('POST', 'PlanTrip', planBody())
    assert(r.status === 200, `expected 200, got ${r.status}: ${JSON.stringify(r.json)}`)
    trip = r.json
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

await step('PayOnTrip before anything is locked is refused', async () => {
  const r = await child('POST', 'PayOnTrip', payBody(`harness-${Date.now()}-early`, PAY_JPY))
  assert(refused(r), `expected a refusal, got ${r.status} ${JSON.stringify(r.json)}`)
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

await step('closing twice is refused', async () => {
  const r = await parent('POST', `CloseTrip?TripId=${field(trip, 'id')}`)
  assert(refused(r), `expected a refusal, got ${r.status}`)
})

summary()

function planBody() {
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
  }
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
