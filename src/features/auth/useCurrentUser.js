import { useQuery } from '@tanstack/react-query'
import { FamilyApi } from '../family/api'
import { keys, useMe } from '../family/queries'
import { getSessionAccountId, getSessionCustomerId, isLoggedIn } from './session'

// Who is using the app, in one place: the session ids, the family role and link,
// and optionally the profile (name and balance). Screens ask this instead of
// combining session helpers with several family hooks.
//
// The role is one cached request shared by every screen that calls this hook. The
// profile (GetMe) is only fetched when `profile` is true.
export function useCurrentUser({ profile = false } = {}) {
  const roleQuery = useQuery({
    queryKey: keys.role,
    queryFn: FamilyApi.getMyFamilyRole,
    enabled: isLoggedIn(),
  })
  const me = useMe(profile)
  const role = roleQuery.data?.role

  return {
    isLoggedIn: isLoggedIn(),
    customerId: getSessionCustomerId(),
    accountId: getSessionAccountId(),
    role,
    familyLinkId: roleQuery.data?.familyLinkId,
    isParent: role === 'Parent',
    isChild: role === 'Child',
    profile: me.data,
    profileError: me.error,
    isLoading: roleQuery.isLoading || (profile && me.isLoading),
    error: roleQuery.error,
  }
}
