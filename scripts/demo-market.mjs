// Demo-day switch: moves the FX market for ONE trip so a presentation can show
// auto-lock firing and a lock paying off, whatever the real rates are today.
//
//   npm run demo:market -- <tripId>            show the trip's shift and rates
//   npm run demo:market -- <tripId> +3         SGD buys 3% more foreign (target hit)
//   npm run demo:market -- <tripId> -4         SGD buys 4% less (locking paid off)
//   npm run demo:market -- <tripId> off        back to the real market
//
// The shift is stored on the trip (SmartFX_Atomic Trip.DemoRateShiftPct) and
// applied by SmartFX (quotes for auto-lock, LockNow) and Trip CloseTrip. Other
// trips never see it, and the trip pages show a "Demo market" badge while it
// is on. Real bank forwards are still booked at the bank's own rate.
//
// Presentation-day run (parent 0000002169, child 0000002828):
//   1. Parent plans a trip in the UI, auto-lock ON, target rate about 2% above
//      the live forward (press "Use forward", then add 2%). Budget ~S$1000:
//      locking moves no money, only paying does.
//   2. npm run demo:market -- <tripId> +3   then "Check now" on Manage FX & locks:
//      the target is hit and SmartFX auto-locks the whole budget.
//      ("Check now" runs the same all-trips check as the 5-minute timer.)
//   3. Child pays a small QR on the trip (real ~S$1, once).
//   4. npm run demo:market -- <tripId> -4   then parent closes the trip:
//      "Locking saved S$X versus today's rate" (about 5% of the pot at today's
//      rates; the script prints the exact figure before you close).
//   5. npm run demo:market -- <tripId> off
import { env } from './_lib.mjs'

const ORIGIN = 'https://smuedu-dev.outsystemsenterprise.com'
const ATOMIC = `${ORIGIN}/WeTrip_SmartFX_Atomic/rest/SmartFXData`
const SMARTFX = `${ORIGIN}/WeTrip_SmartFX_Composite/rest/SmartFX`

const [tripArg, shiftArg] = process.argv.slice(2)
const tripId = Number(tripArg)
if (!tripId) {
  console.error('usage: npm run demo:market -- <tripId> [+N | -N | off]')
  process.exit(1)
}

const get = async (url) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return r.json()
}

const trip = await get(`${ATOMIC}/GetTrip?TripId=${tripId}`)
if (!trip.Id) throw new Error(`No trip ${tripId}`)

if (shiftArg !== undefined) {
  const shift = shiftArg === 'off' ? 0 : Number(shiftArg)
  if (!Number.isFinite(shift) || Math.abs(shift) > 20) {
    throw new Error('Shift must be "off" or a percent between -20 and 20')
  }
  // UpdateTrip replaces the whole record, so send back everything we read.
  const r = await fetch(`${ATOMIC}/UpdateTrip`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...trip, DemoRateShiftPct: shift }),
  })
  if (!r.ok) throw new Error(`UpdateTrip ${r.status} ${await r.text()}`)
  trip.DemoRateShiftPct = shift
}

const shift = Number(trip.DemoRateShiftPct) || 0
const q = new URLSearchParams({
  currency: trip.Currency,
  period: '3M',
  apiKey: env('WETRIP_SERVER_KEY'),
  sessionToken: `${trip.ParentCustomerId}:${trip.ParentAccountId}:DemoMarket`,
})
const rate = await get(`${SMARTFX}/GetRate?${q}`)
const f = Number(rate.forwardRate ?? rate.ForwardRate)
const s = Number(rate.spotRate ?? rate.SpotRate)
const at = (x) => (x * (1 + shift / 100)).toFixed(4)

console.log(`Trip ${tripId} · ${trip.Destination} · ${trip.Status}`)
console.log(`  demo shift      ${shift ? `${shift > 0 ? '+' : ''}${shift}%` : 'off (real market)'}`)
console.log(`  3M forward      ${f.toFixed(4)} real -> ${at(f)} ${trip.Currency} per SGD`)
console.log(`  spot            ${s.toFixed(4)} real -> ${at(s)}`)
console.log(`  target rate     ${Number(trip.TargetRate).toFixed(4)}`)
if (Number(trip.LockedSgd) > 0) {
  const locked = Number(trip.LockedForeign) / Number(trip.LockedSgd)
  const saved = Number(trip.LockedForeign) / (s * (1 + shift / 100)) - Number(trip.LockedSgd)
  console.log(`  locked          ${locked.toFixed(4)} on SGD ${Number(trip.LockedSgd).toFixed(2)}`)
  console.log(
    `  close now       ${saved >= 0 ? 'saves' : 'costs'} SGD ${Math.abs(saved).toFixed(2)} vs spot`,
  )
}
