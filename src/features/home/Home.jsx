import { useState } from 'react'
import { usePendingRequests } from '../family/queries'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, getSessionDisplayName } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import { firstName, maskAccount } from './homeData'
import FamilyOverview from './components/FamilyOverview'
import { EyeIcon } from './components/Icons'
import QuickActions from './components/QuickActions'
import RecentPayments from './components/RecentPayments'
import MilesCard from './components/MilesCard'
import NextTrip from './components/NextTrip'
import { money } from '../../lib/format'

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

      {/* Trip-first: the next trip leads, on one dark band with the balance. */}
      <section className="home-hero">
        <div className="home-top">
          <h1 className="hero-greeting">
            Hi, {firstName(user?.displayName || getSessionDisplayName())}!
          </h1>
          <div className="balance-pill">
            <span className="balance-label">Available balance</span>
            <span className="hero-amount">
              {user ? (hidden ? 'SGD ••••••' : money(user.balance)) : '…'}
            </span>
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
        </div>
        {user && <div className="hero-sub">Deposit account {maskAccount(user.accountId)}</div>}
        <NextTrip />
      </section>

      {role && <QuickActions role={role} />}

      {pendingApprovals > 0 && (
        <Banner kind="warn">
          {pendingApprovals} spend {pendingApprovals === 1 ? 'request is' : 'requests are'} waiting
          for your approval.
        </Banner>
      )}

      <h2 className="section-title">Your accounts</h2>
      <FamilyOverview role={role} pendingApprovals={pendingApprovals} />
      {role === 'Child' && <MilesCard />}

      <h2 className="section-title">Recent activity</h2>
      <RecentPayments />
    </AppShell>
  )
}
