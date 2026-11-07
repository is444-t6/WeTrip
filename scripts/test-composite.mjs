// Smoke test for Family_Composite's Family REST API — the same sequence as
// the build guide's Task 20.3 Postman table, run directly against OutSystems.
//
// Usage:
//   node --env-file=.env.test scripts/test-composite.mjs
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
// The only lasting effect is the small amount (SPEND_TOTAL below) that ends
// up with the merchant. If the demo child is already linked, LinkChild is
// skipped and the existing familyLinkId is reused.
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

// Money plan for one run. Within-budget spends go straight to the merchant;
// the approved over-budget request does too; the rejected one moves nothing.
const FOOD = 10
const RENT = 20
const APPROVED_EXTRA = 25
const REJECTED_EXTRA = 25
const HEADROOM = 50 // budget = already spent + HEADROOM, so FOOD + RENT fit and the extras don't
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

try {
  await step('GetMyFamilyRole (parent) responds', async () => {
    const { status, json } = await asParent('GET', 'GetMyFamilyRole')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'role') === 'Parent', `expected role Parent, got ${JSON.stringify(json)}`)
  })

  await step('FindCustomerByPhone finds the child', async () => {
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

  await step('LinkChild (or reuse an existing link)', async () => {
    const { status, json } = await asParent('POST', 'LinkChild', {
      childCustomerId: CHILD_CUSTOMER_ID,
      nickname: 'Test harness child',
      hostCurrency: 'KRW',
    })
    if (status === 200) {
      familyLinkId = field(json, 'id')
      return
    }
    // Already linked — fall through to GetChildren below to find it.
    console.log(
      `      LinkChild responded ${status} (${json?.Errors?.[0] ?? 'likely already linked'}), reusing existing link`,
    )
  })

  if (!familyLinkId) {
    await step('Resolve familyLinkId via GetChildren', async () => {
      const { status, json } = await asParent('GET', 'GetChildren')
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
      const match = json.find((c) => field(c, 'childCustomerId') === CHILD_CUSTOMER_ID)
      assert(
        match,
        `no existing link found for child ${CHILD_CUSTOMER_ID} — check LinkChild error above`,
      )
      familyLinkId = field(match, 'familyLinkId')
    })
  }

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
      `expected 200, got ${status}: ${JSON.stringify(json)} — try a different WEEKLY_MONTHLY value in .env.test`,
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
    assert(field(json, 'status') === 'Completed', `expected Completed, got ${JSON.stringify(json)}`)
  })

  await step(`ChildSpend within budget completes immediately (${RENT}, Rent)`, async () => {
    const { status, json } = await asChild('POST', 'ChildSpend', {
      merchantAccountId: MERCHANT_ACCOUNT_ID,
      amount: RENT,
      category: 'Rent',
      narrative: `${runTag} rent`,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'status') === 'Completed', `expected Completed, got ${JSON.stringify(json)}`)
  })

  await step('Dashboard spending rose by exactly what was spent', async () => {
    const spentNow = await readSpent()
    assert(
      near(spentNow, spentBefore + FOOD + RENT),
      `expected spent ${money(spentBefore + FOOD + RENT)}, got ${spentNow}`,
    )
  })

  let approveId
  let rejectId

  await step(
    `ChildSpend over budget creates a PendingApproval request (${APPROVED_EXTRA}, Study)`,
    async () => {
      const { status, json } = await asChild('POST', 'ChildSpend', {
        merchantAccountId: MERCHANT_ACCOUNT_ID,
        amount: APPROVED_EXTRA,
        category: 'Study',
        narrative: `${runTag} study`,
      })
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
      assert(
        field(json, 'status') === 'PendingApproval',
        `expected PendingApproval, got ${JSON.stringify(json)}`,
      )
      approveId = field(json, 'requestId')
      createdRequestIds.push(approveId)
    },
  )

  await step(
    `ChildSpend over budget creates a second request to reject (${REJECTED_EXTRA}, Other)`,
    async () => {
      const { status, json } = await asChild('POST', 'ChildSpend', {
        merchantAccountId: MERCHANT_ACCOUNT_ID,
        amount: REJECTED_EXTRA,
        category: 'Other',
        narrative: `${runTag} other`,
      })
      assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
      assert(
        field(json, 'status') === 'PendingApproval',
        `expected PendingApproval, got ${JSON.stringify(json)}`,
      )
      rejectId = field(json, 'requestId')
      createdRequestIds.push(rejectId)
    },
  )

  await step('GetPendingRequests (parent) lists both requests', async () => {
    const { status, json } = await asParent('GET', 'GetPendingRequests')
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    for (const id of [approveId, rejectId]) {
      assert(
        json.some((r) => field(r, 'requestId') === id),
        `requestId ${id} not found in pending list: ${JSON.stringify(json)}`,
      )
    }
  })

  await step('DecideRequest (parent) approves one and the money moves', async () => {
    const childBefore = await readBalance('child')
    const { status, json } = await asParent('POST', 'DecideRequest', {
      requestId: approveId,
      approve: true,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'status') === 'Approved', `expected Approved, got ${JSON.stringify(json)}`)
    const childAfter = await readBalance('child')
    // The bank charges the sender a small fee per transfer (0.05 observed), so
    // the child pays the amount plus a few cents, not exactly the amount.
    const paid = money(childBefore - childAfter)
    assert(
      paid >= APPROVED_EXTRA && paid <= APPROVED_EXTRA + 1,
      `expected the child to pay ${APPROVED_EXTRA} plus a small fee, but the balance went ${childBefore} -> ${childAfter}`,
    )
  })

  await step('DecideRequest (parent) rejects the other and no money moves', async () => {
    const childBefore = await readBalance('child')
    const { status, json } = await asParent('POST', 'DecideRequest', {
      requestId: rejectId,
      approve: false,
    })
    assert(status === 200, `expected 200, got ${status}: ${JSON.stringify(json)}`)
    assert(field(json, 'status') === 'Rejected', `expected Rejected, got ${JSON.stringify(json)}`)
    const childAfter = await readBalance('child')
    assert(
      near(childAfter, childBefore),
      `rejecting should not move money: child balance went ${childBefore} -> ${childAfter}`,
    )
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
      requestId: approveId,
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
