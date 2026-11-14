import { Link } from '@tanstack/react-router'
import { useTrips } from '../../fx/queries'
import { splitTrips, tripStatus } from '../../fx/status'
import { useCurrentUser } from '../../auth/useCurrentUser'
import { useChildTrips } from '../../family/tripQueries'
import { useChildren } from '../../family/queries'
import Money from '../../../components/Money'
import { tripCountdown, tripOver } from '../homeData'
import { dayRange, rate } from '../../../lib/format'

// Home leads with the soonest trip that has not ended. A parent sees every
// linked child's trips; a child sees their own. Only GetTrips fields are used,
// so Home never waits on a trip overview.
export default function NextTrip() {
  const { role, familyLinkId, isLoading: roleLoading, error: roleError } = useCurrentUser()
  const isParent = role === 'Parent'
  // useTrips stays disabled until GetChildren answers, so a parent's trips are
  // still loading while the children are.
  const children = useChildren()
  const parentTrips = useTrips()
  const childTrips = useChildTrips(role === 'Child' ? familyLinkId : undefined)
  const query = role === 'Child' ? childTrips : parentTrips
  const loading = roleLoading || query.isLoading || (isParent && children.isLoading)
  const failed = roleError || query.error || (isParent && children.error)

  // Open trips whose end date has passed (never closed) go after the real ones.
  const active = splitTrips(query.data).active
  const [next, ...later] = [
    ...active.filter((t) => !tripOver(t)),
    ...active.filter((t) => tripOver(t)),
  ]

  if (loading) return <p className="next-trip-note">Loading your trips…</p>
  if (failed) return <p className="next-trip-note">Your trips are unavailable right now.</p>

  if (!next) {
    return (
      <div className="next-trip-empty">
        <p className="next-trip-note">
          {role === 'Child'
            ? 'No trip yet. When your parent plans one, it shows up here.'
            : 'No trip planned yet. Plan one and lock a rate before you fly.'}
        </p>
        {isParent && (
          <Link to="/fx" className="btn secondary">
            Plan a trip
          </Link>
        )}
      </div>
    )
  }

  return (
    <>
      <Link to="/trips/$tripId" params={{ tripId: String(next.tripId) }} className="next-trip">
        <span className="next-trip-eyebrow">Next up · {tripCountdown(next)}</span>
        <h2 className="next-trip-city">{next.destination}</h2>
        <span className="next-trip-dates">
          {dayRange(next.tripStartDate, next.tripEndDate)} · {next.currency}
          {isParent && next.childNickname ? ` · ${next.childNickname}` : ''}
        </span>
        <span className="next-trip-pot">
          <span className="row-between">
            <span className="next-trip-label">Trip pot</span>
            <span className={`badge ${tripStatus(next.status).tone}`}>
              {tripStatus(next.status).label}
            </span>
          </span>
          <span className="next-trip-amount">
            <Money amount={next.lockedForeign} currency={next.currency} />
          </span>
          <span className="next-trip-rates">
            <span>
              <span className="next-trip-label">Last checked</span>
              {/* GetTrips carries the watcher's last check, not a live quote. */}
              <strong>{rate(next.currentRate || next.lastCheckedRate)}</strong>
            </span>
            <span>
              <span className="next-trip-label">Target · higher is better</span>
              <strong>{rate(next.targetRate)}</strong>
            </span>
          </span>
          <span className="next-trip-label">{next.currency} per 1 SGD</span>
          <span className="next-trip-open">Open trip</span>
        </span>
      </Link>
      {later.length > 0 && (
        <ul className="later-trips" aria-label="Other trips">
          {later.map((t) => (
            <li key={t.tripId}>
              <Link to="/trips/$tripId" params={{ tripId: String(t.tripId) }}>
                <span className="later-trips-code">{t.currency}</span>
                <span className="stack">
                  <strong>{t.destination}</strong>
                  <span>
                    {tripCountdown(t)} ·{' '}
                    {Number(t.lockedForeign) > 0 ? (
                      <Money amount={t.lockedForeign} currency={t.currency} />
                    ) : (
                      'Nothing locked yet'
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
