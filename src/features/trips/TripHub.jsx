import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useCurrentUser } from '../auth/useCurrentUser'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import { useDashboard } from '../budget/queries'
import { useChildren, useChildDashboard } from '../family/queries'
import { saveTrip } from '../insurance/storage'
import { useMyInsurance } from '../insurance/queries'
import { useTrip } from '../fx/queries'
import { tripStatus } from '../fx/status'
import { COUNTRY_BY_CURRENCY, day, foreignSpent, policiesCovering } from './trip'

// One trip, every feature. SmartFX owns the trip, so its trip id is the id every
// other section looks up: Budget is read with the same id, insurance is matched by
// the trip's dates, and the child's account comes from the trip's family link.
// Nothing here writes; each card links on to the feature that owns it.
export default function TripHub() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const { data, error, isLoading } = useTrip(tripId)
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
      <div className="row-between trip-head" style={{ marginBottom: 4 }}>
        <div className="stack">
          <h1 style={{ margin: 0 }}>{trip.destination}</h1>
          <span className="muted">
            {day(trip.tripStartDate)} → {day(trip.tripEndDate)}
          </span>
        </div>
        <span className={`badge ${tripStatus(trip.status).tone}`}>
          {tripStatus(trip.status).label}
        </span>
      </div>

      {role === 'Child' && (
        <Link to="/pay" className="btn" style={{ marginTop: 12 }}>
          Pay
        </Link>
      )}

      <div className="grid-2" style={{ marginTop: 16, alignItems: 'start' }}>
        <MoneyCard tripId={tripId} trip={trip} spends={data.spends || []} />
        <BudgetCard tripId={tripId} role={role} />
        <InsuranceCard trip={trip} role={role} />
        <FamilyCard trip={trip} role={role} />
      </div>
    </>,
  )
}

function MoneyCard({ tripId, trip, spends }) {
  const target = Number(trip.targetBudgetSgd) || 0
  const locked = Number(trip.lockedSgd) || 0
  const pct = target ? Math.min(100, (locked / target) * 100) : 0
  const foreignLocked = Number(trip.lockedForeign) || 0
  const spent = foreignSpent(spends)
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
            <Money amount={foreignLocked} currency={trip.currency} /> locked,{' '}
            <Money amount={spent} currency={trip.currency} /> spent
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

function BudgetCard({ tripId, role }) {
  const { data, error } = useDashboard(tripId)
  const summary = data?.summary
  const lines = summary?.lines ?? []
  const alerts = lines.filter((l) => l.alertLevel && l.alertLevel !== 'OK').length
  return (
    <div className="card" aria-label="Budget">
      <div className="card-header">
        <h3>Budget</h3>
        {alerts > 0 && <span className="badge removed">{alerts} near or over</span>}
      </div>
      {error ? (
        <p className="muted">The budget could not be loaded right now.</p>
      ) : lines.length > 0 ? (
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

function InsuranceCard({ trip, role }) {
  const navigate = useNavigate()
  const { data, error } = useMyInsurance()
  const covering = policiesCovering(data, trip)

  // Start the insurance flow with this trip's destination and dates already filled in.
  function getCover() {
    saveTrip({
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
          {covering.length === 1 ? '1 policy covers' : `${covering.length} policies cover`} these
          dates, for {covering.reduce((n, p) => n + (p.coveredTravellers?.length ?? 0), 0)}{' '}
          traveller(s).
        </p>
      ) : (
        <p className="muted">
          {error ? 'Policies could not be loaded right now.' : 'No policy covers these dates yet.'}
        </p>
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
        <p className="muted">No child account is linked to this trip.</p>
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
