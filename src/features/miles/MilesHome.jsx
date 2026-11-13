import { useRef, useState } from 'react'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'
import { clearSession, getSessionCustomerId, isLoggedIn } from '../auth/session'
import { useMyMiles, useRedeem, useRewards, useSyncMiles } from './queries'
import './miles.css'

const fmt = (n) => Number(n ?? 0).toLocaleString('en-SG')
const when = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : ''

function syncMessage(r) {
  if (r.newTransactions === 0) return "You're up to date. No new spending to add."
  const tx = r.newTransactions === 1 ? '1 new transaction' : `${r.newTransactions} new transactions`
  return `Added ${fmt(r.milesEarned)} miles from ${tx}.`
}

function redeemMessage(r) {
  if (r.cashbackAmount > 0) {
    return `Redeemed ${r.rewardName}. SGD ${r.cashbackAmount.toFixed(2)} has been credited to your account.`
  }
  return `Redeemed ${r.rewardName}. It will apply to your next eligible purchase.`
}

function RewardCard({ reward, balance, busy, confirming, onAsk, onCancel, onConfirm }) {
  const short = reward.milesCost - balance
  return (
    <div className="card miles-reward">
      <div className="row-between">
        <div className="stack">
          <strong>{reward.name}</strong>
          <span className="muted">{reward.description}</span>
        </div>
        <span className="badge active miles-cost">{fmt(reward.milesCost)} miles</span>
      </div>

      {confirming ? (
        <div className="miles-confirm">
          <span>
            Use {fmt(reward.milesCost)} of your {fmt(balance)} miles for {reward.name}?
          </span>
          <div className="miles-actions">
            <button className="secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={busy}>
              {busy ? 'Redeeming…' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="miles-actions">
          {short > 0 && <span className="muted">{fmt(short)} more miles needed</span>}
          <button onClick={onAsk} disabled={busy || short > 0}>
            Redeem
          </button>
        </div>
      )}
    </div>
  )
}

function ActivityRow({ item }) {
  const earn = item.miles > 0
  return (
    <div className="miles-row">
      <div className="stack">
        <span>{item.description || (earn ? 'Miles earned' : 'Miles redeemed')}</span>
        <span className="muted">{when(item.createdOn)}</span>
      </div>
      <span className={`miles-delta ${earn ? 'earn' : 'redeem'}`}>
        {earn ? '+' : '−'}
        {fmt(Math.abs(item.miles))}
      </span>
    </div>
  )
}

export default function MilesHome() {
  const customerId = getSessionCustomerId()
  const miles = useMyMiles(customerId)
  const rewards = useRewards()
  const sync = useSyncMiles(customerId)
  const redeem = useRedeem(customerId)
  const [confirmCode, setConfirmCode] = useState('')
  const [notice, setNotice] = useState('')
  // Blocks a second redeem from a fast double click, before the disabled state renders.
  const inFlight = useRef(false)

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip Miles" />

  function signOut() {
    clearSession()
    window.location.reload()
  }

  function runSync() {
    setNotice('')
    redeem.reset()
    sync.mutate(undefined, { onSuccess: (r) => setNotice(syncMessage(r)) })
  }

  function runRedeem(code) {
    if (inFlight.current) return
    inFlight.current = true
    setNotice('')
    sync.reset()
    redeem.mutate(code, {
      onSuccess: (r) => setNotice(redeemMessage(r)),
      onSettled: () => {
        inFlight.current = false
        setConfirmCode('')
      },
    })
  }

  const balance = miles.data?.balance ?? 0
  const history = miles.data?.transactions ?? []
  const busy = sync.isPending || redeem.isPending
  const error =
    sync.error?.message || redeem.error?.message || miles.error?.message || rewards.error?.message

  return (
    <AppShell onSignOut={signOut}>
      <h1 style={{ margin: 0 }}>Miles</h1>
      <p className="muted" style={{ marginTop: 4 }}>
        Earn 1 mile for every S$1 you spend from your account, then trade them for cashback and
        travel perks.
      </p>

      <Banner>{error}</Banner>
      <Banner kind="ok">{notice}</Banner>

      <div className="hero">
        <div className="hero-label">Your miles</div>
        <div className="hero-amount" aria-live="polite">
          {miles.isLoading ? '…' : `${fmt(balance)} miles`}
        </div>
        <div className="hero-sub">Customer {customerId}</div>
        <div className="hero-foot">
          <button className="secondary" onClick={runSync} disabled={busy}>
            {sync.isPending ? 'Checking your spending…' : 'Sync my spending'}
          </button>
        </div>
      </div>

      <h2 className="section-title">Rewards</h2>
      {rewards.isLoading && (
        <p className="muted" role="status">
          Loading rewards…
        </p>
      )}
      <div className="miles-rewards">
        {(rewards.data ?? []).map((r) => (
          <RewardCard
            key={r.rewardCode}
            reward={r}
            balance={balance}
            busy={busy}
            confirming={confirmCode === r.rewardCode}
            onAsk={() => setConfirmCode(r.rewardCode)}
            onCancel={() => setConfirmCode('')}
            onConfirm={() => runRedeem(r.rewardCode)}
          />
        ))}
      </div>

      <h2 className="section-title">Activity</h2>
      {miles.isLoading && (
        <p className="muted" role="status">
          Loading…
        </p>
      )}
      {miles.data && history.length === 0 && (
        <div className="card empty">No miles yet. Sync your spending to start earning.</div>
      )}
      {history.length > 0 && (
        <div className="card">
          {history.map((item) => (
            <ActivityRow key={item.id ?? item.reference} item={item} />
          ))}
        </div>
      )}
    </AppShell>
  )
}
