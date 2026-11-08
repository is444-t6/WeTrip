import { useQuery } from '@tanstack/react-query'
import { FxApi } from '../fx/api'
import { fxKeys } from '../fx/queries'
import { isLoggedIn } from '../auth/session'

// One child's SmartFX trips. Sits under the same ['fx', 'trips'] prefix as the
// SmartFX screens, so anything that invalidates their trip lists refreshes this
// too. SmartFX trips, single trips and rates are read straight from its
// composite; nothing here writes.
export const useChildTrips = (familyLinkId) =>
  useQuery({
    queryKey: [...fxKeys.trips, 'link', familyLinkId],
    queryFn: () => FxApi.getTrips(familyLinkId),
    enabled: isLoggedIn() && Boolean(familyLinkId),
  })
