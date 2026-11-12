import { decap } from '../../lib/http'
import { serviceClient } from '../../lib/services'

const { call, qs } = serviceClient('fx')

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

  cancelTrip: (tripId) => call('POST', `CancelTrip${qs({ tripId })}`),
  lockNow: async ({ tripId, sgdAmount, period }) => {
    const r = await call('POST', 'LockNow', { tripId, sgdAmount, period })
    return { lock: asLock(r.Lock), trip: asTrip(r.Trip) }
  },

  getRate: (currency, period) => call('GET', `GetRate${qs({ currency, period })}`),
  checkRatesNow: () => call('POST', 'CheckRatesNow'),
}
