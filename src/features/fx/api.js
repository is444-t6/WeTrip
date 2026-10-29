import { createClient, decap } from '../../lib/http'

const { call, qs } = createClient({
  base: import.meta.env.VITE_FX_API_BASE || '/api/fx',
  apiKey: import.meta.env.VITE_FX_API_KEY || import.meta.env.VITE_FAMILY_API_KEY,
  auth: 'params',
})

export const CURRENCIES = [
  { code: 'JPY', name: 'Japanese Yen' },
  { code: 'EUR', name: 'Euro' },
  { code: 'USD', name: 'US Dollar' },
  { code: 'GBP', name: 'Pound Sterling' },
  { code: 'CHF', name: 'Swiss Franc' },
]

// Only 1M / 3M / 6M / 1Y exist on the forward API; pick the shortest tenor that
// still reaches the trip.
export function tenorFor(startDate) {
  if (!startDate) return '1M'
  const days = (new Date(startDate) - new Date()) / 86_400_000
  if (days <= 31) return '1M'
  if (days <= 92) return '3M'
  if (days <= 183) return '6M'
  return '1Y'
}

// OutSystems serialises structure attributes with their declared names
// (PascalCase). `decap` from lib/http normalises them to the camelCase the
// components already use.
const asTrip = (t) => (t ? { ...decap(t), tripId: t.Id } : t)
const asLock = (l) => (l ? { ...decap(l), lockId: l.Id } : l)
const asSpend = (s) => (s ? { ...decap(s), spendId: s.Id } : s)

export const FxApi = {
  getTrips: async (familyLinkId) =>
    (await call('GET', `GetTrips${qs({ familyLinkId })}`)).map(asTrip),

  getTrip: async (tripId) => {
    const d = await call('GET', `GetTrip${qs({ tripId })}`)
    return {
      trip: asTrip(d.Trip),
      locks: (d.Locks || []).map(asLock),
      spends: (d.Spends || []).map(asSpend),
    }
  },

  createTrip: async (body) => asTrip(await call('POST', 'CreateTrip', body)),

  // UpdateTrip is not exposed yet.
  updateTrip: (body) => call('POST', 'UpdateTrip', body),
  cancelTrip: (tripId) => call('POST', `CancelTrip${qs({ tripId })}`),
  lockNow: async ({ tripId, sgdAmount, rate, period, parentAccountId }) => {
    const r = await call('POST', 'LockNow', { tripId, sgdAmount, rate, period, parentAccountId })
    return { lock: asLock(r.Lock), trip: asTrip(r.Trip) }
  },
  tripSpend: async (body) => asSpend(await call('POST', 'TripSpend', body)),
  closeTrip: async ({ tripId, rate }) => asTrip(await call('POST', `CloseTrip${qs({ tripId, rate })}`)),

  getRate: (currency, period) => call('GET', `GetRate${qs({ currency, period })}`),
  checkRatesNow: () => call('POST', 'CheckRatesNow'),
}
