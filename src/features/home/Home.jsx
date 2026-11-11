import { useState } from 'react'
import { usePendingRequests } from '../family/queries'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, getSessionDisplayName } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import { firstName, maskAccount } from './homeData'
import ExploreProducts from './components/ExploreProducts'
import FamilyOverview from './components/FamilyOverview'
import { EyeIcon } from './components/Icons'
import QuickActions from './components/QuickActions'
import RecentPayments from './components/RecentPayments'
import TripWallets from './components/TripWallets'

const HIDE_KEY = 'wetrip_hide_balance'

// A remembered preference only; the page works the same if storage is blocked.
function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === '1'
  } catch {
    return false
  }
}

function writeHidden(hidden) {
  try {
    localStorage.setItem(HIDE_KEY, hidden ? '1' : '0')
  } catch {
    // not remembered; harmless
  }
}

export default function Home() {
  const { profile: user, profileError, role } = useCurrentUser({ profile: true })
  const pending = usePendingRequests(role === 'Parent')
  const pendingApprovals = pending.data?.length ?? 0
  const [hidden, setHidden] = useState(readHidden)

  function toggle() {
    setHidden((h) => {
      writeHidden(!h)
      return !h
    })
  }

  function signOut() {
    clearSession()
    window.location.reload()
  }

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{profileError?.message}</Banner>

      <div className="hero">
        <div className="row-between">
          <h1 className="hero-greeting">
            Hi, {firstName(user?.displayName || getSessionDisplayName())}!
          </h1>
          <button
            type="button"
            className="eye-btn"
            onClick={toggle}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
            aria-pressed={hidden}
          >
            <EyeIcon off={hidden} />
          </button>
        </div>
        <div className="hero-sub" style={{ marginTop: 14 }}>
          Available balance
        </div>
        <div className="hero-amount">
          {user ? (hidden ? 'SGD ••••••' : `SGD ${Number(user.balance ?? 0).toFixed(2)}`) : '…'}
        </div>
        {user && <div className="hero-sub">Deposit account {maskAccount(user.accountId)}</div>}
      </div>

      <QuickActions pendingApprovals={pendingApprovals} />

      {pendingApprovals > 0 && (
        <Banner kind="warn">
          {pendingApprovals} spend {pendingApprovals === 1 ? 'request is' : 'requests are'} waiting
          for your approval.
        </Banner>
      )}

      <h2 className="section-title">Your accounts</h2>
      <FamilyOverview role={role} pendingApprovals={pendingApprovals} />
      <TripWallets role={role} />

      <h2 className="section-title">Recent activity</h2>
      <RecentPayments />

      <h2 className="section-title">Explore WeTrip</h2>
      <ExploreProducts />
    </AppShell>
  )
}
