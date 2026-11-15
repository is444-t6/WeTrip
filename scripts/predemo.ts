// Pre-demo preflight: checks everything the live demo touches, then stages
// ideal conditions so nothing depends on luck. Undo it all with postdemo.ts.
//
//   bun run demo:pre            check, then stage (writes .demo-state.json)
//   bun run demo:pre --check    checks only; changes nothing
//
// Optional in .env.local: DEMO_URL (the Vercel site, to check the deployed
// proxy), DEMO_* ids (see _demo.ts). Run it on the morning of the demo: rates
// move and the BNPL pool allows one pay-later a day.
//
// Staging moves no money unless the child's SGD balance is low (then the parent
// tops it up once). It plans one backup trip ("Osaka (demo)"), locks its whole
// budget under a +5% demo market and then flips the market to -3%, so closing it
// on stage shows locking saved money whatever the real rates do. Locking books a
// real sandbox FX forward; no money moves at booking.

import {
  LINK_ID,
  CHILD,
  PARENT,
  allTrips,
  api,
  childAccount,
  day,
  failed,
  field,
  note,
  parentAccount,
  rate,
  readState,
  setShift,
  sgd,
  sgtMidnightUtc,
  sgtToday,
  step,
  writeState,
} from './_demo.ts'

const CHECK_ONLY = process.argv.includes('--check')
const MIN_CHILD_SGD = 50 // a pay is ~SGD 1; this leaves room for several retakes
const TOP_UP_SGD = 100
const MIN_PARENT_SGD = 500 // live top-up demo plus the backup trip's budget
const BACKUP_BUDGET_SGD = 200
const LOCK_SHIFT = 5 // % the market is moved while the backup trip locks
const CLOSE_SHIFT = -3 // % it sits at afterwards, so closing shows a saving

const sgdBalance = async (token: string, accountId: string) => {
  const list = await api('family', 'GET', 'GetMyAccounts', { as: token })
  const acct = (Array.isArray(list) ? list : []).find(
    (a: any) => field(a, 'accountId') === accountId,
  )
  if (!acct) throw new Error(`account ${accountId} not found for this customer`)
  return Number(field(acct, 'balance'))
}

console.log(
  `\nWeTrip pre-demo ${CHECK_ONLY ? 'check (read-only)' : 'preflight'} · ${sgtToday()} SGT\n`,
)

// ---------- checks: read-only ----------
console.log('Checks')
await step('no earlier preflight left staged', async () => {
  const s = readState()
  if (s && !CHECK_ONLY)
    throw new Error(`already staged at ${s.createdAt}: run bun run demo:post first`)
})
await step(`parent ${PARENT.split(':')[0]} is a Parent`, async () => {
  const r = await api('family', 'GET', 'GetMyFamilyRole')
  if (field(r, 'role') !== 'Parent') throw new Error(`role is ${field(r, 'role')}`)
})
await step(`child ${CHILD.split(':')[0]} is a Child on link ${LINK_ID}`, async () => {
  const r = await api('family', 'GET', 'GetMyFamilyRole', { as: CHILD })
  if (field(r, 'role') !== 'Child' || Number(field(r, 'familyLinkId')) !== LINK_ID)
    throw new Error(`role ${field(r, 'role')}, link ${field(r, 'familyLinkId')}`)
})
await step('the family link is Active', async () => {
  const kids = await api('family', 'GET', 'GetChildren')
  const k = kids.find((c: any) => Number(field(c, 'familyLinkId')) === LINK_ID)
  if (field(k, 'status') !== 'Active') throw new Error(`status ${field(k, 'status')}`)
})
await step(`parent SGD balance covers the demo (≥ ${sgd(MIN_PARENT_SGD)})`, async () => {
  const b = await sgdBalance(PARENT, parentAccount())
  note(sgd(b))
  if (b < MIN_PARENT_SGD) throw new Error(`only ${sgd(b)}`)
})
const childSgd = await step(`child SGD balance (tops up below ${sgd(MIN_CHILD_SGD)})`, async () => {
  const b = await sgdBalance(CHILD, childAccount())
  note(sgd(b))
  return b
})
const live = await step('live JPY forward and spot quote', async () => {
  const r = await rate('JPY')
  if (!(r.forward > 0 && r.spot > 0)) throw new Error(`bad quote ${JSON.stringify(r)}`)
  note(`1M forward ${r.forward.toFixed(4)}, spot ${r.spot.toFixed(4)} JPY per SGD`)
  return r
})
await step(
  'pay-later is still free today (the BNPL pool allows one a day)',
  async () => {
    const plans = await api(
      'stpAtomic',
      'GET',
      `GetBnplPlansSince?Since=${encodeURIComponent(sgtMidnightUtc())}`,
    )
    if (plans.length)
      throw new Error(
        `${plans.length} pay-later plan(s) already made today: demo pay-later may be refused`,
      )
  },
  { soft: true },
)
await step(
  'no trip is left on a demo market',
  async () => {
    const shifted = (await allTrips()).filter((t) => Number(t.DemoRateShiftPct))
    if (shifted.length)
      throw new Error(
        `trips ${shifted.map((t) => `${t.Id} (${t.DemoRateShiftPct}%)`).join(', ')}: bun run demo:post resets them`,
      )
  },
  { soft: true },
)
await step(
  'analytics answers and is not stuck refreshing',
  async () => {
    const r = await api('analytics', 'GET', 'GetInsights')
    const run = r.LastRun ?? {}
    if (run.Status === 'Running' && Date.now() - Date.parse(run.StartedOn) > 10 * 60_000)
      throw new Error(`run ${run.EtlRunId} Running since ${run.StartedOn}`)
    if (run.Status === 'Failed') throw new Error(`last refresh failed: ${run.Error}`)
  },
  { soft: true },
)
const site = process.env.DEMO_URL?.replace(/\/$/, '')
await step(
  site
    ? `deployed site ${site} serves the app and its API proxy`
    : 'deployed site (set DEMO_URL to check it)',
  async () => {
    if (!site) throw new Error('DEMO_URL not set: skipped')
    const page = await fetch(`${site}/insights`)
    if (!page.ok) throw new Error(`/insights ${page.status}`)
    const r = await fetch(`${site}/api/family/GetMyFamilyRole`, {
      headers: { 'X-Session-Token': PARENT },
    })
    if (!r.ok) throw new Error(`proxy ${r.status}: is WETRIP_SERVER_KEY set on Vercel?`)
  },
  { soft: true },
)

if (failed()) {
  console.log(
    `\n\x1b[31m${failed()} check(s) failed.\x1b[0m Fix them before the demo; nothing was changed.\n`,
  )
  process.exit(1)
}
if (CHECK_ONLY) {
  console.log('\nAll required checks passed. Run bun run demo:pre to stage.\n')
  process.exit(0)
}

// ---------- staging: writes, recorded for postdemo ----------
console.log('\nStaging')
const state = {
  createdAt: new Date().toISOString(),
  trips: [] as { id: number; label: string }[],
  topUpSgd: 0,
}
// Record as we go, so a failure halfway can still be undone.
const save = () => writeState(state)
save()

await step('child spending is unfrozen, every category allowed', () =>
  api('family', 'POST', 'SetSpendingRules', {
    body: { familyLinkId: LINK_ID, isFrozen: false, allowedCategories: '', autoApproveUnder: 0 },
  }),
)
if ((childSgd ?? 0) < MIN_CHILD_SGD) {
  await step(`parent tops the child up by ${sgd(TOP_UP_SGD)}`, async () => {
    await api('family', 'POST', 'TopUp', {
      body: { familyLinkId: LINK_ID, amount: TOP_UP_SGD, narrative: 'Demo float' },
    })
    state.topUpSgd = TOP_UP_SGD
    save()
  })
}

const backup = await step(
  `backup trip "Osaka (demo)" planned with ${sgd(BACKUP_BUDGET_SGD)}`,
  async () => {
    const r = await api('trip', 'POST', 'PlanTrip', {
      body: {
        FamilyLinkId: LINK_ID,
        Destination: 'Osaka (demo)',
        Currency: 'JPY',
        TripStartDate: day(5),
        TripEndDate: day(10),
        TargetBudgetSgd: BACKUP_BUDGET_SGD,
        TargetRate: Number(live!.forward.toFixed(4)),
        AutoLockEnabled: false,
        Budgets: [
          { CategoryId: 6, LimitAmount: 80 }, // Food
          { CategoryId: 2, LimitAmount: 60 }, // Transport
          { CategoryId: 1, LimitAmount: 60 }, // Activities
        ],
      },
    })
    const id = Number(field(r, 'id'))
    if (!id) throw new Error(`no trip id in ${JSON.stringify(r).slice(0, 200)}`)
    state.trips.push({ id, label: 'Osaka (demo) backup' })
    save()
    note(`trip ${id}`)
    return id
  },
)
if (backup) {
  await step(`backup trip locked in full under a +${LOCK_SHIFT}% demo market`, async () => {
    await setShift(backup, LOCK_SHIFT)
    const r = await api('smartfx', 'POST', 'LockNow', {
      body: { tripId: backup, sgdAmount: BACKUP_BUDGET_SGD, period: '1M' },
    })
    const lock = r.Lock ?? r.lock ?? {}
    note(
      `locked at ${Number(lock.LockedRate ?? 0).toFixed(4)} JPY per SGD${lock.FxForwardId ? `, forward ${lock.FxForwardId}` : ''}`,
    )
  })
  await step(`market flipped to ${CLOSE_SHIFT}% so closing shows a saving`, async () => {
    await setShift(backup, CLOSE_SHIFT)
    const o = await api('trip', 'GET', `GetCloseOptions?TripId=${backup}`)
    // What converting the unspent pot back at today's (demo) spot is worth, minus what it cost.
    const saved = Number(field(o, 'valueAtSpotSgd')) - Number(field(o, 'costAtLockedSgd'))
    if (Number.isFinite(saved)) {
      note(`closing now ${saved >= 0 ? 'saves' : 'costs'} ${sgd(Math.abs(saved))} vs spot`)
      if (saved <= 0) throw new Error('closing would not show a saving')
    }
  })
}

if (failed()) {
  console.log(
    `\n\x1b[31m${failed()} staging step(s) failed.\x1b[0m Run bun run demo:post to undo what was done, then retry.\n`,
  )
  process.exit(1)
}

const target = live!.forward - 0.5
console.log(`
\x1b[32mReady.\x1b[0m Staged changes are in .demo-state.json; bun run demo:post undoes them.

Demo script
  Parent  ${PARENT.split(':')[0]}   Child  ${CHILD.split(':')[0]}  (use one browser tab each)
  1. Parent plans a trip live (Trips → New trip, child on link ${LINK_ID}, JPY, auto-lock ON).
     Target rate: ${target.toFixed(4)} or lower (today's forward is ${live!.forward.toFixed(4)}),
     so the target is already met. On the trip's Manage FX & locks, tap "Check now": it auto-locks.
  2. Child pays on that trip: Pay, scan the JPY 120 QR (or paste it), Pay now. Then the
     JPY 2600 QR, Pay later (once today).
  3. Backup if step 1 misbehaves: trip ${backup} "Osaka (demo)" is already locked; the child can pay on it.
  4. Parent closes trip ${backup}: it shows locking saved money (Demo market ${CLOSE_SHIFT}% badge).
  5. /insights → Refresh data.
`)
