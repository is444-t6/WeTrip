// Ended trips, collapsed under one line so the active ones stay in view.
export default function PastTrips({ trips, children }) {
  if (!trips?.length) return null
  return (
    <details className="past-trips" style={{ marginTop: 12 }}>
      <summary className="muted">Past trips ({trips.length})</summary>
      <div style={{ marginTop: 8 }}>{trips.map(children)}</div>
    </details>
  )
}
