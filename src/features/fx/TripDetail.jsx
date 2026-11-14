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
import { demoLabel, demoRate, isEnded, tripStatus } from './status'
import { useCancelTrip, useCheckRates, useLockNow, useRate, useTrip } from './queries'
import { day, dayRange, money, rate, rateText } from '../../lib/format'
import { maskAccount } from '../home/homeData'

export default function TripDetail() {
  const { tripId } = useParams({ from: '/fx/trips/$tripId' })
  const { data, error, isLoading, refetch, isFetching } = useTrip(tripId)
  const { role } = useCurrentUser()

  const trip = data?.trip
  const quote = useRate(trip?.currency, tenorFor(trip?.tripStartDate))
  const checkRates = useCheckRates()
  const forward = demoRate(quote.data?.forwardRate, trip)
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
  if (error) {
    return shell(
      <>
        <Banner>{error.message}</Banner>
        <div className="row" style={{ gap: 8 }}>
          <Link to="/fx" className="btn secondary">
            All trips
          </Link>
          <button
            type="button"
            className="secondary"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            {isFetching ? 'Trying…' : 'Try again'}
          </button>
        </div>
      </>,
    )
  }
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
      <Link to="/trips/$tripId" params={{ tripId: String(trip.tripId) }} className="back-link">
        &larr; Back to {trip.destination}
      </Link>

      <h1>{trip.destination}</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        {dayRange(trip.tripStartDate, trip.tripEndDate)} · {statusLabel}
        {trip.childNickname ? ` · ${trip.childNickname}` : ''}
        {demoLabel(trip) && (
          <span className="badge pending" style={{ marginLeft: 8 }}>
            {demoLabel(trip)}
          </span>
        )}
      </p>

      <BalanceHero
        label="Locked pot"
        amount={remainingForeign}
        currency={trip.currency}
        sub={`${money(trip.lockedSgd)} locked of ${money(trip.targetBudgetSgd)}`}
        foot={
          <>
            <span>
              {locks.length} lock{locks.length === 1 ? '' : 's'}
            </span>
            {trip.autoLockEnabled && <span>Auto-lock on</span>}
          </>
        }
      />

      <RateGauge current={forward} target={trip.targetRate} currency={trip.currency} />

      {role === 'Parent' && (
        <ParentActions
          trip={trip}
          remainingSgd={remainingSgd}
          currentRate={forward}
          // Runs the same check as the 5-minute timer, so an auto-lock fires now.
          onCheck={() => checkRates.mutate(undefined, { onSettled: () => quote.refetch() })}
          checking={checkRates.isPending || quote.isFetching}
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
                  <td data-label="Date">{day(l.createdAt)}</td>
                  <td data-label="Rate">{rate(l.lockedRate)}</td>
                  <td data-label="SGD" style={{ textAlign: 'right' }}>
                    <Money amount={l.sgdAmount} />
                  </td>
                  <td data-label={trip.currency} style={{ textAlign: 'right' }}>
                    {money(l.foreignAmount, trip.currency)}
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
                  <td data-label="Date">{day(s.createdAt)}</td>
                  <td data-label="Category">{s.category}</td>
                  <td data-label="To" className="muted">
                    {maskAccount(s.merchantAccountId)}
                  </td>
                  <td data-label="Amount" style={{ textAlign: 'right' }}>
                    {money(s.amount, trip.currency)}
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
            <span className="badge active">Closed</span>
          </div>
          <div className="row-between">
            <span className="muted">
              {money(trip.returnedForeign, trip.currency)} at{' '}
              {rateText(trip.returnRate, trip.currency)}
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

const TENORS = [
  ['1M', '1 mo', '1-month'],
  ['3M', '3 mo', '3-month'],
  ['6M', '6 mo', '6-month'],
  ['1Y', '1 yr', '1-year'],
]
const tenorWords = (period) => TENORS.find(([v]) => v === period)?.[2] ?? period

function ParentActions({ trip, remainingSgd, currentRate, onCheck, checking }) {
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(tenorFor(trip.tripStartDate))
  const [confirming, setConfirming] = useState(false) // the next tap on Cancel trip commits
  const lock = useLockNow()
  const cancel = useCancelTrip()

  const live = Number(currentRate) || 0
  const open = !isEnded(trip.status)
  const lockable = trip.status === 'Watching' || trip.status === 'PartiallyLocked'
  const canLock = lockable && remainingSgd > 0 && Number(amount) > 0
  const hasLocked = Number(trip.lockedSgd) > 0
  const canCancel = open && !hasLocked
  const error = lock.error || cancel.error

  return (
    <div className="card">
      <div className="card-header">
        <h3>Lock a rate</h3>
        <span className="badge pending">{money(remainingSgd)} not locked yet</span>
      </div>
      <Banner>{error?.message}</Banner>
      <Banner kind="ok">
        {lock.data
          ? `Locked ${money(lock.data.lock?.sgdAmount)} at ${rateText(lock.data.lock?.lockedRate, trip.currency)}.`
          : ''}
      </Banner>

      <div className="grid-2">
        <div className="field">
          <label htmlFor="trip-lock-amount">Lock now (SGD)</label>
          <input
            id="trip-lock-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            max={remainingSgd}
            value={amount}
            placeholder={`Up to ${money(remainingSgd)}`}
            onChange={(e) => setAmount(e.target.value)}
          />
          {lockable && remainingSgd > 0 && (
            <button
              type="button"
              className="chip"
              style={{ marginTop: 8 }}
              onClick={() => setAmount(String(remainingSgd))}
            >
              Lock all {money(remainingSgd)}
            </button>
          )}
        </div>
        <fieldset className="field pill-choice">
          <legend>Lock for</legend>
          <div className="pill-choice-row">
            {TENORS.map(([value, label]) => (
              <label key={value}>
                <input
                  type="radio"
                  name="trip-lock-tenor"
                  value={value}
                  aria-label={tenorWords(value)}
                  checked={period === value}
                  onChange={() => setPeriod(value)}
                />
                <span aria-hidden="true">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <p className="muted" style={{ marginTop: 0, fontSize: '0.85em' }}>
        Locks at today&apos;s {tenorWords(period)} rate ({rateText(live, trip.currency)}), not at a
        rate you type.
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
        <button type="button" className="secondary span-2" disabled={checking} onClick={onCheck}>
          {checking ? 'Checking…' : 'Check the rate now'}
        </button>
        {canCancel && (
          <button
            type="button"
            className="danger span-2"
            disabled={cancel.isPending}
            onClick={() =>
              confirming
                ? cancel.mutate(trip.tripId, { onSettled: () => setConfirming(false) })
                : setConfirming(true)
            }
          >
            {confirming ? 'Confirm cancel?' : 'Cancel trip'}
          </button>
        )}
        {confirming && (
          <button type="button" className="secondary span-2" onClick={() => setConfirming(false)}>
            Go back
          </button>
        )}
      </div>
      {open && hasLocked && (
        <p className="muted" style={{ margin: '12px 0 0', fontSize: '0.85em' }}>
          Trips with locked money can&apos;t be cancelled.{' '}
          <Link to="/trips/$tripId" params={{ tripId: String(trip.tripId) }}>
            Close it from the trip page
          </Link>{' '}
          when you&apos;re back.
        </p>
      )}
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
