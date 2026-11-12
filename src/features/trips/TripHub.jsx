import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import { useChildren, useChildDashboard } from '../family/queries'
import { saveTrip } from '../insurance/storage'
import { demoLabel, isEnded, tripStatus } from '../fx/status'
import FixedCostsNotice from './FixedCostsNotice'
import ReceiptForm from './ReceiptForm'
import { useCloseTrip, useTripOverview } from './queries'
import { COUNTRY_BY_CURRENCY, day } from './trip'
import { useState } from 'react'

// One trip, every feature, from one call: Trip.GetTripOverview gathers the SmartFX
// trip, its locks and spends, the SGD budget and the policies bought for it. The
// child pays from here (Pay on this trip) and the parent closes the trip here.
export default function TripHub() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const { data, error, isLoading } = useTripOverview(tripId)
  const { role } = useCurrentUser()

  function signOut() {
    clearSession()
    window.location.reload()
  }
  const shell = (content) => <AppShell onSignOut={signOut}>{content}</AppShell>

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip" />
  if (error) return shell(<Banner>{error.message}</Banner>)
  if (isLoading || !data) return shell(<p className="muted">Loading…</p>)

  const trip = data.trip
  return shell(
    <>
      <Link to="/fx" className="back-link">
        &larr; All trips
      </Link>
      <FixedCostsNotice />
      <div className="row-between trip-head" style={{ marginBottom: 4 }}>
        <div className="stack">
          <h1 style={{ margin: 0 }}>{trip.destination}</h1>
          <span className="muted">
            {day(trip.tripStartDate)} → {day(trip.tripEndDate)}
          </span>
        </div>
        <span className="row" style={{ gap: 6 }}>
          {demoLabel(trip) && <span className="badge pending">{demoLabel(trip)}</span>}
          <span className={`badge ${tripStatus(trip.status).tone}`}>
            {tripStatus(trip.status).label}
          </span>
        </span>
      </div>

      {role === 'Child' && !isEnded(trip.status) && Number(data.remainingForeign) > 0 && (
        <Link
          to="/pay"
          search={{ tripId: Number(tripId) }}
          className="btn"
          style={{ marginTop: 12 }}
        >
          Pay on this trip
        </Link>
      )}

      {role === 'Child' && !isEnded(trip.status) && <ReceiptForm trip={trip} />}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <MoneyCard tripId={tripId} overview={data} />
        <BudgetCard tripId={tripId} role={role} overview={data} />
        <InsuranceCard trip={trip} role={role} tripPolicies={data.policies} />
        <FamilyCard trip={trip} role={role} />
      </div>

      {((role === 'Parent' && !isEnded(trip.status)) || trip.status === 'Completed') && (
        <CloseTripCard tripId={tripId} trip={trip} />
      )}
    </>,
  )
}

function MoneyCard({ tripId, overview }) {
  const trip = overview.trip
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const foreignLocked = Number(trip.lockedForeign) || 0
  const spent = Number(overview.spentForeign) || 0
  const left = Number(overview.remainingForeign) || 0
  const rate = Number(overview.lockedRate) || 0
  return (
    <div className="card" aria-label="Money">
      <div className="card-header">
        <h3>Money (SmartFX)</h3>
      </div>
      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>
      <div className="row-between muted" style={{ fontSize: '0.85em', marginTop: 4 }}>
        <span>
          <Money amount={locked} /> locked
        </span>
        <span>
          of <Money amount={target} />
        </span>
      </div>
      <p style={{ margin: '10px 0 0' }}>
        {foreignLocked > 0 ? (
          <>
            <Money amount={left} currency={trip.currency} /> left of{' '}
            <Money amount={foreignLocked} currency={trip.currency} /> (
            <Money amount={spent} currency={trip.currency} /> spent)
            {rate > 0 && (
              <span className="muted" style={{ display: 'block', fontSize: '0.85em' }}>
                Locked at {rate.toFixed(4)} {trip.currency} per SGD
              </span>
            )}
          </>
        ) : (
          <span className="muted">Nothing locked yet.</span>
        )}
      </p>
      <Link
        to="/fx/trips/$tripId"
        params={{ tripId: String(tripId) }}
        className="btn secondary"
        style={{ width: '100%', marginTop: 12 }}
      >
        Manage FX &amp; locks
      </Link>
    </div>
  )
}

function BudgetCard({ tripId, role, overview }) {
  const summary = overview.hasBudget ? overview.budget : null
  const lines = summary?.lines ?? []
  const alerts = lines.filter((l) => l.alertLevel && l.alertLevel !== 'OK').length
  return (
    <div className="card" aria-label="Budget">
      <div className="card-header">
        <h3>Budget</h3>
        {alerts > 0 && <span className="badge removed">{alerts} near or over</span>}
      </div>
      {lines.length > 0 ? (
        <>
          <p style={{ margin: 0 }}>
            <Money amount={summary.totalSpent} currency="SGD" /> spent of{' '}
            <Money amount={summary.totalLimit} currency="SGD" />
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {lines.length} categories
          </p>
        </>
      ) : (
        <p className="muted">
          No category budget yet.
          {role === 'Parent' ? ' Split the trip money by category.' : ''}
        </p>
      )}
      {Number(summary?.fixedSgd) > 0 && (
        <p className="muted" style={{ margin: '4px 0 0' }}>
          <Money amount={summary.fixedSgd} currency="SGD" /> fixed
        </p>
      )}
      <Link
        to="/budget/$tripId"
        params={{ tripId: String(tripId) }}
        className="btn secondary"
        style={{ width: '100%', marginTop: 12 }}
      >
        {lines.length > 0 || role !== 'Parent' ? 'Open budget' : 'Set a budget'}
      </Link>
    </div>
  )
}

function InsuranceCard({ trip, role, tripPolicies }) {
  const navigate = useNavigate()
  // Only policies bought for this trip (linked by TripId) count as cover.
  const covering = (tripPolicies ?? []).filter((p) => p.status !== 'Cancelled')

  // Start the insurance flow with this trip's destination and dates already filled in.
  function getCover() {
    saveTrip({
      tripId: trip.id,
      destination: trip.destination,
      destinationCode: COUNTRY_BY_CURRENCY[trip.currency] || '',
      startDate: day(trip.tripStartDate),
      endDate: day(trip.tripEndDate),
    })
    navigate({ to: '/insurance' })
  }

  return (
    <div className="card" aria-label="Insurance">
      <div className="card-header">
        <h3>Insurance</h3>
        {covering.length > 0 && <span className="badge active">Covered</span>}
      </div>
      {covering.length > 0 ? (
        <p style={{ margin: 0 }}>
          {covering.length === 1 ? '1 policy covers' : `${covering.length} policies cover`} this
          trip.
        </p>
      ) : (
        <p className="muted">No policy covers this trip yet.</p>
      )}
      {covering.length > 0 ? (
        <Link
          to="/insurance/policies"
          className="btn secondary"
          style={{ width: '100%', marginTop: 12 }}
        >
          Open my insurance
        </Link>
      ) : role === 'Parent' ? (
        <button type="button" onClick={getCover} style={{ width: '100%', marginTop: 12 }}>
          Get cover for this trip
        </button>
      ) : null}
    </div>
  )
}

function FamilyCard({ trip, role }) {
  const parentView = role === 'Parent'
  const childView = role === 'Child'
  const children = useChildren()
  const dash = useChildDashboard()
  const linked = parentView
    ? children.data?.find((c) => c.familyLinkId === trip.familyLinkId)
    : null
  const who = parentView ? linked : childView ? dash.data : null
  const name = parentView ? linked?.nickname : dash.data?.nickname
  const loading =
    useCurrentUser().isLoading ||
    (parentView && children.isLoading) ||
    (childView && dash.isLoading)
  const budget = Number(who?.budget) || 0
  const spent = Number(who?.spent) || 0
  return (
    <div className="card" aria-label="Family">
      <div className="card-header">
        <h3>Family</h3>
      </div>
      {who ? (
        <>
          <p style={{ margin: 0 }}>
            <strong>{name || 'Child'}</strong> has <Money amount={who.balance} />
          </p>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            {budget > 0 ? (
              <>
                <Money amount={spent} /> spent of <Money amount={budget} /> this period
              </>
            ) : (
              'No spending limit set.'
            )}
          </p>
        </>
      ) : (
        <p className="muted">{loading ? 'Loading…' : 'No child account is linked to this trip.'}</p>
      )}
      {who && (
        <Link
          to={parentView ? '/family/child/$familyLinkId' : '/family'}
          params={parentView ? { familyLinkId: String(trip.familyLinkId) } : undefined}
          className="btn secondary"
          style={{ width: '100%', marginTop: 12 }}
        >
          {parentView ? 'Manage in Family' : 'Open Family'}
        </Link>
      )}
    </div>
  )
}

// Closing values whatever foreign money is left at today's server spot rate and
// marks the trip Completed. No money moves; the confirm step says so.
function CloseTripCard({ tripId, trip }) {
  const close = useCloseTrip(tripId)
  const [confirming, setConfirming] = useState(false)
  // After the refetch the trip reads Completed; keep showing what closing found,
  // rebuilt from the stored close for anyone opening the trip later.
  const lockedForeign = Number(trip.lockedForeign) || 0
  const returnRate = Number(trip.returnRate) || 0
  const result =
    close.data ??
    (trip.status === 'Completed'
      ? {
          returnedForeign: trip.returnedForeign,
          returnedSgd: trip.returnedSgd,
          savedVsSpotSgd:
            returnRate > 0 && lockedForeign > 0
              ? lockedForeign / returnRate - (Number(trip.lockedSgd) || 0)
              : 0,
        }
      : null)
  return (
    <div className="card" aria-label="Close trip" style={{ marginTop: 16 }}>
      <div className="card-header">
        <h3>Close &amp; convert back</h3>
      </div>
      <Banner>{close.error?.message}</Banner>
      {result ? (
        <p style={{ margin: 0 }}>
          Trip closed. <Money amount={result.returnedForeign} currency={trip.currency} /> unspent,
          worth <Money amount={result.returnedSgd} /> today.{' '}
          {Number(result.savedVsSpotSgd) >= 0 ? 'Locking saved ' : 'Locking cost '}
          <Money amount={Math.abs(Number(result.savedVsSpotSgd) || 0)} /> versus today's rate.
        </p>
      ) : confirming ? (
        <>
          <p style={{ margin: '0 0 12px' }}>
            Close the trip and value the unspent {trip.currency} at today's rate? This cannot be
            undone.
          </p>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" disabled={close.isPending} onClick={() => close.mutate()}>
              {close.isPending ? 'Closing…' : 'Close trip'}
            </button>
            <button type="button" className="secondary" onClick={() => setConfirming(false)}>
              Keep it open
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="secondary" onClick={() => setConfirming(true)}>
          Close trip
        </button>
      )}
    </div>
  )
}
