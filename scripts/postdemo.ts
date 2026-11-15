// Post-demo rollback: undoes predemo.ts and tidies what the demo left behind.
//
//   bun run demo:post               roll back (safe to run more than once)
//   bun run demo:post --keep-trips  only reset markets and rules; leave trips open
//
// It puts every trip back on the real market, closes or cancels the trips
// predemo staged and any trip opened on the demo family link since then (a
// trip with a lock is closed at the real spot rate; one without is cancelled),
// and reopens the child's spending rules. Sandbox money is not moved back:
// a pre-demo top-up stays with the child, and payments made on stage stand.

import {
  LINK_ID,
  allTrips,
  api,
  clearState,
  failed,
  note,
  readState,
  setShift,
  sgd,
  step,
} from './_demo.ts'

const KEEP_TRIPS = process.argv.includes('--keep-trips')
const state = readState()
const DONE = new Set(['Completed', 'Cancelled'])

console.log(
  `\nWeTrip post-demo rollback${state ? ` (staged ${state.createdAt})` : ' (no staged state; resetting markets and rules only)'}\n`,
)

const trips = (await step('read all trips', allTrips)) ?? []

// Every trip back on the real market, staged or not.
for (const t of trips.filter((x) => Number(x.DemoRateShiftPct))) {
  await step(
    `trip ${t.Id} (${t.Destination}) back on the real market (was ${t.DemoRateShiftPct}%)`,
    () => setShift(t.Id, 0),
  )
}

if (state && !KEEP_TRIPS) {
  const staged = new Set(state.trips.map((t) => t.id))
  const since = Date.parse(state.createdAt)
  const open = trips.filter(
    (t) =>
      !DONE.has(t.Status) &&
      (staged.has(t.Id) ||
        (Number(t.FamilyLinkId) === LINK_ID && Date.parse(t.CreatedAt) >= since)),
  )
  for (const t of open) {
    const locked = Number(t.LockedSgd) > 0
    await step(
      `trip ${t.Id} (${t.Destination}) ${locked ? 'closed at the real spot rate' : 'cancelled'}`,
      () =>
        locked
          ? api('trip', 'POST', `CloseTrip?TripId=${t.Id}`)
          : api('smartfx', 'POST', `CancelTrip?${new URLSearchParams({ tripId: String(t.Id) })}`),
    )
  }
  if (!open.length) note('no open demo trips to tidy')
}

await step('child spending unfrozen, every category allowed', () =>
  api('family', 'POST', 'SetSpendingRules', {
    body: { familyLinkId: LINK_ID, isFrozen: false, allowedCategories: '', autoApproveUnder: 0 },
  }),
)

if (state?.topUpSgd)
  note(
    `the pre-demo top-up of ${sgd(state.topUpSgd)} stays with the child (sandbox money is not reversed)`,
  )

if (failed()) {
  console.log(
    `\n\x1b[31m${failed()} step(s) failed.\x1b[0m .demo-state.json is kept; fix and run bun run demo:post again.\n`,
  )
  process.exit(1)
}
clearState()
console.log('\n\x1b[32mBack to normal.\x1b[0m\n')
