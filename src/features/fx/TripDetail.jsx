import { useState } from 'react'
import { Link, useParams } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import SignedOutCard from '../../components/SignedOutCard'
import Money from '../../components/Money'
import BalanceHero from '../../components/BalanceHero'
import RateGauge from './components/RateGauge'
import { tenorFor } from './api'
import { isEnded, tripStatus } from './status'
import { useCloseTrip } from '../trips/queries'
import { useCancelTrip, useLockNow, useRate, useTrip } from './queries'

export default function TripDetail() {
  const { tripId } = useParams({ from: '/fx/trips/$tripId' })
  const { data, error, isLoading } = useTrip(tripId)
  const { role } = useCurrentUser()

  const trip = data?.trip
  const quote = useRate(trip?.currency, tenorFor(trip?.tripStartDate))
  const locks = data?.locks || []
  const spends = data?.spends || []

  function signOut() {
    clearSession()
    window.location.reload()
  }

  // Every state of the page sits inside the app shell, so the navbar and the
  // side gutter are always there, including while loading or after an error.
  const shell = (content) => <AppShell onSignOut={signOut}>{content}</AppShell>

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip SmartFX" />
  if (error) return shell(<Banner>{error.message}</Banner>)
  if (isLoading || !trip) return shell(<p className="muted">Loading…</p>)

  const spentForeign = spends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  const remainingForeign = Math.max(0, (Number(trip.lockedForeign) || 0) - spentForeign)
  const remainingSgd =
    Math.round(
      Math.max(0, (Number(trip.targetBudgetSgd) || 0) - (Number(trip.lockedSgd) || 0)) * 100,
    ) / 100
  // The status can still read PartiallyLocked once the whole budget is locked.
  const statusLabel =
    !isEnded(trip.status) && Number(trip.lockedSgd) > 0 && remainingSgd <= 0
      ? 'Fully locked'
      : tripStatus(trip.status).label
  return shell(
    <>
      <Link
        to="/fx"
        className="muted"
        style={{ display: 'inline-block', marginBottom: 14, fontWeight: 600 }}
      >
        &larr; Back to trips
      </Link>

      <h1>{trip.destination}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {String(trip.tripStartDate).slice(0, 10)} → {String(trip.tripEndDate).slice(0, 10)} ·{' '}
        {statusLabel}
        {trip.childNickname ? ` · ${trip.childNickname}` : ''}
      </p>

      <BalanceHero
        label="Locked pot"
        amount={remainingForeign}
        currency={trip.currency}
        sub={`${Number(trip.lockedSgd).toFixed(2)} SGD locked of ${Number(trip.targetBudgetSgd).toFixed(2)}`}
        foot={
          <>
            <span>
              {locks.length} lock{locks.length === 1 ? '' : 's'}
            </span>
            {trip.autoLockEnabled && <span>auto-lock on</span>}
          </>
        }
      />

      <RateGauge
        current={quote.data?.forwardRate}
        target={trip.targetRate}
        currency={trip.currency}
      />

      {role === 'Parent' && (
        <ParentActions
          trip={trip}
          remainingSgd={remainingSgd}
          currentRate={quote.data?.forwardRate}
          onCheck={quote.refetch}
          checking={quote.isFetching}
        />
      )}
      {role === 'Child' && remainingForeign > 0 && <PayOnTripCard trip={trip} />}

      <h2 className="section-title">Rate locks</h2>
      <div className="card">
        {locks.length === 0 && <p className="muted">Nothing locked yet.</p>}
        {locks.length > 0 && (
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rate</th>
                <th style={{ textAlign: 'right' }}>SGD</th>
                <th style={{ textAlign: 'right' }}>{trip.currency}</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {locks.map((l) => (
                <tr key={l.lockId}>
                  <td data-label="Date">{String(l.createdAt).slice(0, 10)}</td>
                  <td data-label="Rate">{Number(l.lockedRate).toFixed(4)}</td>
                  <td data-label="SGD" style={{ textAlign: 'right' }}>
                    <Money amount={l.sgdAmount} />
                  </td>
                  <td data-label={trip.currency} style={{ textAlign: 'right' }}>
                    {Number(l.foreignAmount).toFixed(2)}
                  </td>
                  <td data-label="Source" className="muted">
                    {l.source}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">Spending</h2>
      <div className="card">
        {spends.length === 0 && <p className="muted">No spending recorded.</p>}
        {spends.length > 0 && (
          <table className="stack-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>To</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {spends.map((s) => (
                <tr key={s.spendId}>
                  <td data-label="Date">{String(s.createdAt).slice(0, 10)}</td>
                  <td data-label="Category">{s.category}</td>
                  <td data-label="To" className="muted">
                    {s.merchantAccountId}
                  </td>
                  <td data-label="Amount" style={{ textAlign: 'right' }}>
                    {Number(s.amount).toFixed(2)} {trip.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {trip.status === 'Completed' && (
        <div className="card">
          <div className="card-header">
            <h3>Converted back</h3>
            <span className="badge active">closed</span>
          </div>
          <div className="row-between">
            <span className="muted">
              {Number(trip.returnedForeign).toFixed(2)} {trip.currency} at{' '}
              {Number(trip.returnRate).toFixed(4)}
            </span>
            <span className="money">
              <Money amount={trip.returnedSgd} />
            </span>
          </div>
        </div>
      )}
    </>,
  )
}

function ParentActions({ trip, remainingSgd, currentRate, onCheck, checking }) {
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(tenorFor(trip.tripStartDate))
  const [confirming, setConfirming] = useState('') // 'close' | 'cancel': the next tap commits
  const lock = useLockNow()
  const cancel = useCancelTrip()
  const close = useCloseTrip(trip.tripId)

  const rate = Number(currentRate) || 0
  const open = !isEnded(trip.status)
  const lockable = trip.status === 'Watching' || trip.status === 'PartiallyLocked'
  const canLock = lockable && remainingSgd > 0 && Number(amount) > 0
  const canClose = open
  const canCancel = open && !(Number(trip.lockedSgd) > 0)
  const error = lock.error || cancel.error || close.error
  const reset = { onSettled: () => setConfirming('') }

  return (
    <div className="card">
      <div className="card-header">
        <h3>Controls</h3>
        <span className="badge pending">{remainingSgd.toFixed(2)} SGD unlocked</span>
      </div>
      <Banner>{error?.message}</Banner>
      <Banner kind="ok">
        {close.data
          ? `Closed. ${Number(close.data.returnedForeign).toFixed(2)} ${trip.currency} unspent, valued at today's ${Number(close.data.spotRate).toFixed(4)}.`
          : lock.data
            ? `Locked ${Number(lock.data.lock?.sgdAmount).toFixed(2)} SGD at ${Number(lock.data.lock?.lockedRate).toFixed(4)}.`
            : ''}
      </Banner>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="trip-lock-amount">Lock now (SGD)</label>
          <input
            id="trip-lock-amount"
            type="number"
            step="0.01"
            min="0.01"
            max={remainingSgd}
            value={amount}
            placeholder={`Up to ${remainingSgd.toFixed(2)}`}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="trip-lock-tenor">Tenor</label>
          <select id="trip-lock-tenor" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="1M">1M</option>
            <option value="3M">3M</option>
            <option value="6M">6M</option>
            <option value="1Y">1Y</option>
          </select>
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85em' }}>
        Locks at the live {period} forward ({rate ? rate.toFixed(4) : '—'} {trip.currency} per SGD),
        not at a rate you type.
      </p>

      <div className="actions-grid">
        <button
          type="button"
          className="span-2"
          disabled={lock.isPending || !canLock}
          onClick={() =>
            lock.mutate(
              {
                tripId: trip.tripId,
                sgdAmount: Math.min(Number(amount), remainingSgd),
                period,
              },
              { onSuccess: () => setAmount('') },
            )
          }
        >
          {lock.isPending ? 'Locking…' : 'Lock rate'}
        </button>
        <button type="button" className="secondary" disabled={checking} onClick={onCheck}>
          {checking ? 'Checking…' : 'Check now'}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!canClose || close.isPending}
          onClick={() =>
            confirming === 'close' ? close.mutate(undefined, reset) : setConfirming('close')
          }
        >
          {close.isPending
            ? 'Converting…'
            : confirming === 'close'
              ? 'Confirm close?'
              : 'Close & convert back'}
        </button>
        <button
          type="button"
          className="danger span-2"
          disabled={!canCancel || cancel.isPending}
          onClick={() =>
            confirming === 'cancel' ? cancel.mutate(trip.tripId, reset) : setConfirming('cancel')
          }
        >
          {confirming === 'cancel' ? 'Confirm cancel?' : 'Cancel trip'}
        </button>
        {confirming && (
          <button type="button" className="secondary span-2" onClick={() => setConfirming('')}>
            Go back
          </button>
        )}
      </div>
    </div>
  )
}

// Paying from the pot goes through the Trip composite: scan the merchant's QR and
// the trip pays at its locked rate, and the budget records the spend.
function PayOnTripCard({ trip }) {
  return (
    <div className="card">
      <h3>Pay from the pot</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Scan a merchant's QR to pay from this trip at its locked rate.
      </p>
      <Link
        to="/pay"
        search={{ tripId: Number(trip.tripId) }}
        className="btn"
        style={{ width: '100%' }}
      >
        Pay on this trip
      </Link>
    </div>
  )
}
