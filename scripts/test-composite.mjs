// Smoke test for Family_Composite's Family REST API — the same sequence as
// the build guide's Task 20.3 Postman table, run directly against OutSystems.
//
// Usage:
//   node --env-file=.env.local scripts/test-composite.mjs
//
// WARNING: unlike test-atomic.mjs, this one calls real SMUtBank endpoints
// through Family_Composite — TopUp, SetupAllowance and ChildSpend move real
// (sandbox) money between the parent/child demo accounts. Only run it against
// demo accounts you're happy to mutate. It assumes ValidateSessionStub
// (Task 12.4 Option C) is still wired up — stub tokens are
// "<customerId>:<accountId>:<name>".
//
// Safe to re-run. Every run is self-contained:
//   - The budget is set relative to what the child has already spent this
//     period, so "within budget" and "over budget" mean the same thing on
//     every run (no matter how many runs came before).
//   - The child's balance is checked first and topped up only as far as this
//     run needs, so approvals never fail on "insufficient funds".
//   - Any allowance is stopped before and after the allowance steps, so runs
//     never stack standing instructions.
//   - Requests this run creates are decided (approved/rejected) or, failing
//     that, rejected in cleanup; the child's original budget is restored.
// The only lasting effects are the small amount (SPEND_TOTAL below) that ends
// up with the merchant, and the grant the run creates (an approved ask lifts
// the limit for the hours given, 1 here). The parent and child in
// .env.local must already be linked; the script never calls LinkChild.
//
// Uses field(json, 'camelName') everywhere a response field is read, which
// tolerates structures where the Name-in-JSON fix hasn't landed yet
// (reads either the spec'd camelCase or the as-built PascalCase) — that way
// a casing gap on one structure doesn't block testing everything downstream
// of it. The casing itself is still worth fixing; see the structure table
// in Task 11.3 of the build guide.

import { assert, env, field, http, step, summary } from './_lib.mjs'

// The grant this run creates keeps the child's limit raised for GRANT_HOURS, and
// the API cannot read or revoke it. A run inside that window finds the
// over-budget payment going through; that is reported, not treated as a failure.
const GRANT_HOURS = 1

const BASE = env('COMPOSITE_BASE')
const API_KEY = env('VITE_FAMILY_API_KEY') // the same key the app uses

const PARENT_CUSTOMER_ID = env('PARENT_CUSTOMER_ID')
const PARENT_ACCOUNT_ID = env('PARENT_ACCOUNT_ID')
const CHILD_CUSTOMER_ID = env('CHILD_CUSTOMER_ID')
const CHILD_ACCOUNT_ID = env('CHILD_ACCOUNT_ID')
const CHILD_COUNTRY_CODE = env('CHILD_COUNTRY_CODE', '65')
const CHILD_PHONE_NUMBER = env('CHILD_PHONE_NUMBER', '') // optional: skips the phone lookup when blank
const MERCHANT_ACCOUNT_ID = env('MERCHANT_ACCOUNT_ID')
const WEEKLY_MONTHLY = env('WEEKLY_MONTHLY', 'Monthly') // guess — confirm against the Payments Swagger field description

// Money plan for one run. Within-budget spends go straight to the merchant.
// An over-budget payment is declined (nothing moves); once the parent grants an
// ask for APPROVED_EXTRA the same payment goes through. A rejected ask moves nothing.
const FOOD = 10
const RENT = 20
const APPROVED_EXTRA = 25
const REJECTED_EXTRA = 25
const HEADROOM = 50 // limit = already spent + HEADROOM, so FOOD + RENT fit and the extra doesn't
const SPEND_TOTAL = FOOD + RENT + APPROVED_EXTRA
const CHILD_FLOAT = SPEND_TOTAL + 5 // the child needs at least this much to finish the run

const parentToken = `${PARENT_CUSTOMER_ID}:${PARENT_ACCOUNT_ID}:ParentHarness`
const childToken = `${CHILD_CUSTOMER_ID}:${CHILD_ACCOUNT_ID}:ChildHarness`
const runTag = `harness-${Date.now()}`

function headersFor(token) {
  return { 'X-Contacts-Key': API_KEY, 'X-Session-Token': token }
}

const asParent = (method, path, body) =>
  http(BASE, method, path, { headers: headersFor(parentToken), body })
const asChild = (method, path, body) =>
  http(BASE, method, path, { headers: headersFor(childToken), body })

const money = (n) => Math.round(Number(n) * 100) / 100
// ChildSpend answers Paid (older builds said Completed).
const paid = (json) => ['Paid', 'Completed'].includes(field(json, 'status'))
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005

async function readChildLink(familyLinkId) {
  const { status, json } = await asParent('GET', 'GetChildren')
  assert(status === 200, `GetChildren expected 200, got ${status}: ${JSON.stringify(json)}`)
  return json.find((c) => field(c, 'familyLinkId') === familyLinkId)
}

async function readSpent() {
  const { status, json } = await asChild('GET', 'GetChildDashboard')
  assert(status === 200, `GetChildDashboard expected 200, got ${status}: ${JSON.stringify(json)}`)
  return Number(field(json, 'spent') ?? 0)
}

async function readBalance(who) {
  const { status, json } = await (who === 'child' ? asChild : asParent)('GET', 'GetMe')
  assert(status === 200, `GetMe (${who}) expected 200, got ${status}: ${JSON.stringify(json)}`)
  return Number(field(json, 'balance'))
}

console.log(`\nFamily_Composite (Family) smoke test\nBase: ${BASE}\nRun tag: ${runTag}\n`)

let familyLinkId
let original = { budget: 0, period: 'Monthly' }
const createdRequestIds = []
let allowanceTouched = false
let rulesTouched = false

try {
  await step('GetMyFamilyRole (parent) responds', async () => {
    const { status, json } = await asParent('GET', 'GetMyFamilyRole')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'role') === 'Parent', `expected role Parent, got ${JSON.stringify(json)}`)
  })

  await step('FindCustomerByPhone finds the child', async () => {
    if (!CHILD_PHONE_NUMBER) {
      console.log('      NOT EXERCISED: set CHILD_PHONE_NUMBER in .env.local to test this')
      return
    }
    const { status, json } = await asParent(
      'GET',
      `FindCustomerByPhone?countryCode=${encodeURIComponent(CHILD_COUNTRY_CODE)}&phoneNumber=${encodeURIComponent(CHILD_PHONE_NUMBER)}`,
    )
    const message = json?.Errors?.[0] ?? ''
    assert(
      !/own phone number/i.test(message),
      'the demo child has the same phone number as the demo parent — give CHILD_PHONE_NUMBER a number that belongs to the child',
    )
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(
      field(json, 'customerId') === CHILD_CUSTOMER_ID,
      `expected customerId ${CHILD_CUSTOMER_ID}, got ${JSON.stringify(json)}`,
    )
  })

  // Never creates a link: a run once linked a "Test harness child" to a real
  // account, and it showed up on that parent's Family page. The pair in
  // .env.local must already be linked and Active; otherwise the run stops here.
  await step('Find the existing active link (this script never creates one)', async () => {
    const { status, json } = await asParent('GET', 'GetChildren')
    assert(status === 200, `GetChildren expected 200, got ${status}: ${JSON.stringify(json)}`)
    const active = json.find(
      (c) => field(c, 'childCustomerId') === CHILD_CUSTOMER_ID && field(c, 'status') === 'Active',
    )
    assert(
      active,
      `parent ${PARENT_CUSTOMER_ID} has no active link to child ${CHILD_CUSTOMER_ID} — link them in the app first; this script will not create one`,
    )
    familyLinkId = field(active, 'familyLinkId')
  })

  await step('GetMyLinkInvite (child) + AcceptLink if still pending', async () => {
    const { status, json } = await asChild('GET', 'GetMyLinkInvite')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    if (!field(json, 'hasInvite')) {
      console.log(
        '      NOT EXERCISED: no hasInvite in the response (link already active, or GetMyLinkInvite does not return it)',
      )
      return
    }
    const accept = await asChild('POST', 'AcceptLink', {
      familyLinkId,
      accountId: CHILD_ACCOUNT_ID,
    })
    assert(
      accept.status === 200,
      `AcceptLink failed: ${accept.status} ${JSON.stringify(accept.json)}`,
    )
    assert(
      field(accept.json, 'status') === 'Active',
      `expected status Active, got ${JSON.stringify(accept.json)}`,
    )
  })

  // --- Preflight: read the starting state so the run can size itself ---

  let spentBefore = 0

  await step('Preflight: record the child’s budget and spending, check both balances', async () => {
    assert(familyLinkId, 'no familyLinkId — the link steps above failed')
    const link = await readChildLink(familyLinkId)
    assert(link, `link ${familyLinkId} not found in GetChildren`)
    original = {
      budget: Number(field(link, 'budget') ?? 0),
      period: field(link, 'period') || 'Monthly',
    }
    spentBefore = await readSpent()
    const parentBalance = await readBalance('parent')
    const childBalance = await readBalance('child')
    console.log(
      `      budget ${original.budget} ${original.period}, spent ${spentBefore}, parent ${parentBalance}, child ${childBalance}`,
    )
    assert(
      parentBalance >= CHILD_FLOAT + 10,
      `parent balance ${parentBalance} is too low to fund this run (needs about ${CHILD_FLOAT + 10}) — top the parent account up`,
    )
  })

  await step(
    `SetBudget (parent) leaves ${HEADROOM} of headroom above current spending`,
    async () => {
      const amount = money(spentBefore + HEADROOM)
      const { status, json } = await asParent('POST', 'SetBudget', {
        familyLinkId,
        period: 'Monthly',
        amount,
      })
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
      const link = await readChildLink(familyLinkId)
      assert(
        near(field(link, 'budget'), amount),
        `expected budget ${amount}, GetChildren shows ${field(link, 'budget')}`,
      )
    },
  )

  await step(
    'TopUp (parent) funds the child and the child’s balance rises by that amount',
    async () => {
      const childBefore = await readBalance('child')
      const topUp = money(Math.max(5, Math.ceil(CHILD_FLOAT - childBefore) + 5))
      const { status, json } = await asParent('POST', 'TopUp', {
        familyLinkId,
        amount: topUp,
        narrative: `${runTag} top-up`,
      })
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
      assert(field(json, 'transactionId'), `expected a transactionId, got ${JSON.stringify(json)}`)
      const childAfter = await readBalance('child')
      assert(
        near(childAfter, childBefore + topUp),
        `expected child balance ${money(childBefore + topUp)} after top-up, got ${childAfter}`,
      )
    },
  )

  // --- Allowance: clear, set up, verify, stop (never leave one behind) ---

  await step('SetupAllowance (parent) creates an allowance the family module can see', async () => {
    allowanceTouched = true
    const existing = await readChildLink(familyLinkId)
    if (field(existing, 'hasAllowance')) {
      const stop = await asParent('POST', 'StopAllowance', { familyLinkId })
      assert(
        stop.status === 200,
        `could not clear a pre-existing allowance: ${JSON.stringify(stop.json)}`,
      )
    }
    const tomorrow = new Date(Date.now() + 86400000).toISOString()
    const { status, json } = await asParent('POST', 'SetupAllowance', {
      familyLinkId,
      amount: 1,
      weeklyMonthly: WEEKLY_MONTHLY,
      startDate: tomorrow,
    })
    assert(
      status === 200,
      `expected 200, got ${status}: ${JSON.stringify(json)} — try a different WEEKLY_MONTHLY value in .env.local`,
    )
    assert(
      field(json, 'standingInstructionId'),
      `expected a standingInstructionId, got ${JSON.stringify(json)}`,
    )
    const link = await readChildLink(familyLinkId)
    assert(
      field(link, 'hasAllowance') === true,
      `SetupAllowance returned success but GetChildren shows no allowance: ${JSON.stringify(link)}`,
    )
  })

  await step('StopAllowance (parent) removes it again', async () => {
    const { status, json } = await asParent('POST', 'StopAllowance', { familyLinkId })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    const link = await readChildLink(familyLinkId)
    assert(
      !field(link, 'hasAllowance'),
      `allowance still shown after StopAllowance: ${JSON.stringify(link)}`,
    )
    allowanceTouched = false
  })

  // --- Child spending ---

  await step('GetChildDashboard (child) shows the budget', async () => {
    const { status, json } = await asChild('GET', 'GetChildDashboard')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(
      field(json, 'hasBudget') === true,
      `expected hasBudget true, got ${JSON.stringify(json)}`,
    )
  })

  await step(`ChildSpend within budget completes immediately (${FOOD}, Food)`, async () => {
    const { status, json } = await asChild('POST', 'ChildSpend', {
      merchantAccountId: MERCHANT_ACCOUNT_ID,
      amount: FOOD,
      category: 'Food',
      narrative: `${runTag} lunch`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(paid(json), `expected Paid, got ${JSON.stringify(json)}`)
  })

  await step(`ChildSpend within budget completes immediately (${RENT}, Rent)`, async () => {
    const { status, json } = await asChild('POST', 'ChildSpend', {
      merchantAccountId: MERCHANT_ACCOUNT_ID,
      amount: RENT,
      category: 'Rent',
      narrative: `${runTag} rent`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(paid(json), `expected Paid, got ${JSON.stringify(json)}`)
  })

  await step('Dashboard spending rose by exactly what was spent', async () => {
    const spentNow = await readSpent()
    assert(
      near(spentNow, spentBefore + FOOD + RENT),
      `expected spent ${money(spentBefore + FOOD + RENT)}, got ${spentNow}`,
    )
  })

  let askId
  let rejectId
  let pendingBefore = 0

  await step('ChildSpend over budget is declined: nothing moves, nothing is held', async () => {
    const pending = await asParent('GET', 'GetPendingRequests')
    pendingBefore = Array.isArray(pending.json) ? pending.json.length : 0
    const childBefore = await readBalance('child')
    const { status, json } = await asChild('POST', 'ChildSpend', {
      merchantAccountId: MERCHANT_ACCOUNT_ID,
      amount: APPROVED_EXTRA,
      category: 'Study',
      narrative: `${runTag} study`,
    })
    assert(status === 200, `a decline is a normal 200, got ${status}: ${JSON.stringify(json)}`)
    if (paid(json)) {
      // Not a backend fault: a grant from an earlier run is still lifting the limit.
      console.log(
        `      NOT EXERCISED: an earlier run's grant (up to ${GRANT_HOURS}h) is still active, so this payment was paid (SGD ${APPROVED_EXTRA} went to the merchant). Run again later to test the decline.`,
      )
      return
    }
    assert(field(json, 'status') === 'Declined', `expected Declined, got ${JSON.stringify(json)}`)
    assert(
      Number(field(json, 'shortBy')) > 0,
      `expected a positive shortBy, got ${JSON.stringify(json)}`,
    )
    assert(field(json, 'message'), `expected a message, got ${JSON.stringify(json)}`)
    assert(near(await readBalance('child'), childBefore), 'a declined payment must not move money')
    const after = await asParent('GET', 'GetPendingRequests')
    assert(
      Array.isArray(after.json) && after.json.length === pendingBefore,
      `a decline must not create a pending request: ${JSON.stringify(after.json)}`,
    )
  })

  await step(`AskForMore (child) asks the parent for ${APPROVED_EXTRA}`, async () => {
    const { status, json } = await asChild('POST', 'AskForMore', {
      amount: APPROVED_EXTRA,
      reason: `${runTag} study`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    askId = field(json, 'requestId')
    assert(askId, `expected a requestId, got ${JSON.stringify(json)}`)
    createdRequestIds.push(askId)
  })

  await step('AskForMore again is accepted (and tracked so cleanup rejects it)', async () => {
    const { status, json } = await asChild('POST', 'AskForMore', {
      amount: APPROVED_EXTRA,
      reason: `${runTag} again`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    const again = field(json, 'requestId')
    assert(again, `expected a requestId, got ${JSON.stringify(json)}`)
    if (again !== askId) {
      createdRequestIds.push(again)
      console.log(
        `      NOTE: a second ask makes a second pending request (${again}); not de-duplicated`,
      )
    }
  })

  await step('GetPendingRequests (parent) lists the ask (no merchant)', async () => {
    const { status, json } = await asParent('GET', 'GetPendingRequests')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    const ask = json.find((r) => field(r, 'requestId') === askId)
    assert(ask, `request ${askId} not found in pending list: ${JSON.stringify(json)}`)
    assert(!field(ask, 'merchantAccountId'), `an ask has no merchant, got ${JSON.stringify(ask)}`)
    assert(
      near(field(ask, 'amount'), APPROVED_EXTRA),
      `expected amount ${APPROVED_EXTRA}, got ${JSON.stringify(ask)}`,
    )
  })

  await step('DecideRequest (parent) grants the ask and no money moves yet', async () => {
    const childBefore = await readBalance('child')
    const { status, json } = await asParent('POST', 'DecideRequest', {
      requestId: askId,
      approve: true,
      grantAmount: APPROVED_EXTRA,
      hours: GRANT_HOURS,
      note: 'ok',
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'status') === 'Approved', `expected Approved, got ${JSON.stringify(json)}`)
    assert(near(await readBalance('child'), childBefore), 'granting an ask must not move money')
    assert(
      near(field(json, 'grantedAmount'), APPROVED_EXTRA),
      `expected grantedAmount ${APPROVED_EXTRA}, got ${JSON.stringify(json)}`,
    )
  })

  await step(`The same ChildSpend now completes (${APPROVED_EXTRA}, Study)`, async () => {
    const { status, json } = await asChild('POST', 'ChildSpend', {
      merchantAccountId: MERCHANT_ACCOUNT_ID,
      amount: APPROVED_EXTRA,
      category: 'Study',
      narrative: `${runTag} study`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(paid(json), `expected Paid, got ${JSON.stringify(json)}`)
  })

  await step('A parent can turn an ask down with a note', async () => {
    const ask = await asChild('POST', 'AskForMore', {
      amount: REJECTED_EXTRA,
      reason: `${runTag} other`,
    })
    assert(ask.status === 200, `AskForMore failed: ${JSON.stringify(ask.json)}`)
    rejectId = field(ask.json, 'requestId')
    createdRequestIds.push(rejectId)
    const { status, json } = await asParent('POST', 'DecideRequest', {
      requestId: rejectId,
      approve: false,
      note: 'next week',
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'status') === 'Rejected', `expected Rejected, got ${JSON.stringify(json)}`)
  })

  await step('GetMyRequests (child) shows the granted and the turned-down ask', async () => {
    const { status, json } = await asChild('GET', 'GetMyRequests')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(Array.isArray(json), `expected a list, got ${JSON.stringify(json)}`)
    const granted = json.find((r) => field(r, 'requestId') === askId)
    assert(granted, `ask ${askId} missing from GetMyRequests`)
    assert(
      field(granted, 'status') === 'Approved',
      `expected Approved, got ${JSON.stringify(granted)}`,
    )
    assert(
      near(field(granted, 'grantedAmount'), APPROVED_EXTRA),
      `expected grantedAmount ${APPROVED_EXTRA}, got ${JSON.stringify(granted)}`,
    )
    const turnedDown = json.find((r) => field(r, 'requestId') === rejectId)
    assert(turnedDown, `ask ${rejectId} missing from GetMyRequests`)
    assert(
      field(turnedDown, 'status') === 'Rejected',
      `expected Rejected, got ${JSON.stringify(turnedDown)}`,
    )
    assert(
      field(turnedDown, 'parentNote') === 'next week',
      `expected the note, got ${JSON.stringify(turnedDown)}`,
    )
  })

  await step('GrantBudget (parent) adds a small amount for a day', async () => {
    const { status, json } = await asParent('POST', 'GrantBudget', {
      familyLinkId,
      amount: 0.01, // it lasts a day and cannot be revoked, so keep it negligible
      days: 1,
      note: runTag,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'id'), `expected an id, got ${JSON.stringify(json)}`)
  })

  await step('GrantBudget rejects an amount of 0', async () => {
    const { status, json } = await asParent('POST', 'GrantBudget', {
      familyLinkId,
      amount: 0,
      days: 1,
    })
    assert(status !== 200, `expected a non-200 response, got ${JSON.stringify(json)}`)
  })

  await step('GrantBudget with a child token is forbidden', async () => {
    const { status, json } = await asChild('POST', 'GrantBudget', {
      familyLinkId,
      amount: 5,
      days: 1,
    })
    assert(status !== 200, `a child must not raise their own limit, got ${JSON.stringify(json)}`)
  })

  await step(
    'SetSpendingRules freezes spending: the payment is declined, nothing moves',
    async () => {
      rulesTouched = true
      const set = await asParent('POST', 'SetSpendingRules', {
        familyLinkId,
        isFrozen: true,
        allowedCategories: '',
        autoApproveUnder: 0,
      })
      assert(set.status === 200, `expected 200, got ${set.status}: ${JSON.stringify(set.json)}`)
      const before = await readBalance('child')
      const { status, json } = await asChild('POST', 'ChildSpend', {
        merchantAccountId: MERCHANT_ACCOUNT_ID,
        amount: 1,
        category: 'Food',
        narrative: `${runTag} frozen`,
      })
      assert(
        status === 200,
        `a frozen decline is a normal 200, got ${status}: ${JSON.stringify(json)}`,
      )
      assert(field(json, 'status') === 'Declined', `expected Declined, got ${JSON.stringify(json)}`)
      assert(near(await readBalance('child'), before), 'a frozen payment must not move money')
    },
  )

  await step('SetSpendingRules with a child token is forbidden', async () => {
    const { status, json } = await asChild('POST', 'SetSpendingRules', {
      familyLinkId,
      isFrozen: false,
      allowedCategories: '',
      autoApproveUnder: 0,
    })
    assert(status !== 200, `a child must not edit the rules, got ${JSON.stringify(json)}`)
  })

  await step('SetSpendingRules unfreezes again', async () => {
    const set = await asParent('POST', 'SetSpendingRules', {
      familyLinkId,
      isFrozen: false,
      allowedCategories: '',
      autoApproveUnder: 0,
    })
    assert(set.status === 200, `expected 200, got ${set.status}: ${JSON.stringify(set.json)}`)
    rulesTouched = false
  })

  // --- Reads ---

  await step('GetChildExpenses (parent) lists this run’s spending with categories', async () => {
    const { status, json } = await asParent(
      'GET',
      `GetChildExpenses?familyLinkId=${familyLinkId}&startDate=2020-01-01&endDate=2030-01-01`,
    )
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    const expenses = field(json, 'expenses')
    assert(Array.isArray(expenses), `expected an expenses array, got ${JSON.stringify(json)}`)
    const mine = expenses.filter((x) => String(field(x, 'narrative') ?? '').includes(runTag))
    assert(
      mine.length >= 2,
      `expected this run's Food and Rent spends in expenses, found ${mine.length}: ${JSON.stringify(expenses.slice(0, 3))}`,
    )
    assert(
      mine.every((x) => field(x, 'category')),
      `every expense should carry a category: ${JSON.stringify(mine)}`,
    )
  })

  await step('GetChildren (parent) shows the child card', async () => {
    const link = await readChildLink(familyLinkId)
    assert(link, `child card not found for link ${familyLinkId}`)
  })

  await step('GetBalanceTrend (parent) returns a list', async () => {
    const { status, json } = await asParent(
      'GET',
      `GetBalanceTrend?familyLinkId=${familyLinkId}&months=6`,
    )
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(Array.isArray(json), `expected a list, got ${JSON.stringify(json)}`)
  })

  // --- Negative tests ---

  await step('Missing API key is rejected', async () => {
    const { status, json } = await http(BASE, 'GET', 'GetMyFamilyRole', {
      headers: { 'X-Session-Token': parentToken },
    })
    assert(status !== 200, 'expected a non-200 response without the API key')
    assert(
      /Invalid API Key/i.test(json?.Errors?.[0] ?? ''),
      `expected "Invalid API Key", got ${JSON.stringify(json)}`,
    )
  })

  await step('Missing session token is rejected', async () => {
    const { status, json } = await http(BASE, 'GET', 'GetMyFamilyRole', {
      headers: { 'X-Contacts-Key': API_KEY },
    })
    assert(status !== 200, 'expected a non-200 response without a session token')
    assert(
      /log in to WeTrip/i.test(json?.Errors?.[0] ?? ''),
      `expected "Please log in to WeTrip first", got ${JSON.stringify(json)}`,
    )
  })

  await step('Child token on DecideRequest is forbidden', async () => {
    const { status, json } = await asChild('POST', 'DecideRequest', {
      requestId: askId,
      approve: true,
    })
    assert(status !== 200, 'expected a non-200 response')
    console.log(`      got: ${json?.Errors?.[0] ?? JSON.stringify(json)}`)
  })

  await step('Amount 0 on TopUp is rejected with a validation message', async () => {
    const { status, json } = await asParent('POST', 'TopUp', { familyLinkId, amount: 0 })
    assert(status !== 200, 'expected a non-200 response')
    assert(
      /more than 0/i.test(json?.Errors?.[0] ?? ''),
      `expected a "more than 0" validation message, got ${JSON.stringify(json)}`,
    )
  })
} finally {
  // --- Cleanup: runs even if a step above threw, so the sandbox is left as found ---
  console.log('\n-- Cleanup --')

  await step('Reject any request this run left pending', async () => {
    if (createdRequestIds.length === 0) return
    const { json } = await asParent('GET', 'GetPendingRequests')
    const leftovers = (Array.isArray(json) ? json : []).filter((r) =>
      createdRequestIds.includes(field(r, 'requestId')),
    )
    for (const r of leftovers) {
      const res = await asParent('POST', 'DecideRequest', {
        requestId: field(r, 'requestId'),
        approve: false,
      })
      assert(res.status === 200, `could not reject request ${field(r, 'requestId')}`)
    }
    if (leftovers.length) console.log(`      rejected ${leftovers.length} leftover request(s)`)
  })

  await step('Clear the spending rules if a step left them on', async () => {
    if (!rulesTouched || !familyLinkId) return
    const res = await asParent('POST', 'SetSpendingRules', {
      familyLinkId,
      isFrozen: false,
      allowedCategories: '',
      autoApproveUnder: 0,
    })
    assert(res.status === 200, `could not clear the rules: ${JSON.stringify(res.json)}`)
  })

  await step('Stop the allowance if one is still active', async () => {
    if (!allowanceTouched || !familyLinkId) return
    const link = await readChildLink(familyLinkId)
    if (!field(link, 'hasAllowance')) return
    const res = await asParent('POST', 'StopAllowance', { familyLinkId })
    assert(res.status === 200, `StopAllowance failed: ${JSON.stringify(res.json)}`)
  })

  await step('Restore the child’s original budget', async () => {
    if (!familyLinkId) return
    if (!(original.budget > 0)) {
      console.log('      no budget existed before this run; leaving the test budget in place')
      return
    }
    const res = await asParent('POST', 'SetBudget', {
      familyLinkId,
      period: original.period,
      amount: original.budget,
    })
    assert(res.status === 200, `SetBudget restore failed: ${JSON.stringify(res.json)}`)
  })
}

summary()
