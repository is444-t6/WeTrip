import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import { useInsights, useRunEtlNow } from './queries'

// OutSystems sends 1900-01-01 for an empty date.
const when = (value) => {
  const d = new Date(value)
  return d.getFullYear() > 1900
    ? d.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : null
}
const right = { textAlign: 'right' }

// Internal page, reached by URL only. Everything comes from the analytics data mart
// (WeTrip_Analytics_Composite): all-time aggregates, never customer data.
export default function Insights() {
  const { data, error, isLoading } = useInsights()
  const refresh = useRunEtlNow()

  function signOut() {
    clearSession()
    window.location.reload()
  }

  if (!isLoggedIn()) return <SignedOutCard title="WeTrip" />

  const run = data?.lastRun ?? {}
  const rows = data?.byCurrencyMonth ?? []
  const categories = data?.byCategory ?? []
  const empty = Number(data?.tripsCount) === 0 && !rows.length && !categories.length
  const busy = refresh.isPending || run.status === 'Running'
  const saved = Number(data?.savedVsSpotSgd) || 0
  // OutSystems can't send null: no completed trip with category limits arrives as 0 eligible trips.
  const pct =
    Number(data?.overBudgetEligibleTrips) > 0 ? `${Math.round(data.overBudgetTripPct)}%` : '—'
  const updated = when(data?.lastSuccessOn)
  // Counts of the run this page started, once it has finished.
  const finished = refresh.data && run.etlRunId === refresh.data.etlRunId && !busy

  return (
    <AppShell onSignOut={signOut}>
      <Banner>{error?.message}</Banner>
      {isLoading && <p className="muted">Loading…</p>}
      {data && (
        <>
          <div className="row-between" style={{ marginBottom: 12 }}>
            <h1 style={{ margin: 0 }}>Insights</h1>
            <button type="button" disabled={busy} onClick={() => refresh.mutate()}>
              {busy ? 'Refreshing…' : 'Refresh data'}
            </button>
          </div>
          <Banner>{refresh.error?.message}</Banner>
          {run.status === 'Failed' && <Banner>{run.error || 'The last refresh failed.'}</Banner>}
          {finished && run.status === 'Success' && (
            <Banner kind="ok">
              Refresh finished: {run.rowsExtracted} extracted, {run.rowsLoaded} loaded,{' '}
              {run.rowsRejected} rejected.
            </Banner>
          )}

          {empty ? (
            <p className="muted">No data yet. Refresh to load trip activity.</p>
          ) : (
            <>
              <div className="card">
                <h2 style={{ margin: 0 }}>
                  {saved < 0 ? 'Locking cost families' : 'Locking saved families'}{' '}
                  <Money amount={Math.abs(saved)} />
                </h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  {data.tripsCount} {Number(data.tripsCount) === 1 ? 'trip' : 'trips'} ·{' '}
                  <Money amount={data.spendSgd} /> spent
                </p>
                <p style={{ margin: '12px 0 0' }}>{pct} of completed trips went over budget</p>
                <p style={{ margin: '6px 0 0' }}>
                  Pay later: {data.bnpl?.plans ?? 0} plans ·{' '}
                  <Money amount={data.bnpl?.principalSgd} />
                </p>
                {updated && (
                  <p className="muted" style={{ margin: '12px 0 0' }}>
                    Last updated {updated}
                    {run.status === 'Success' && ` · ${run.rowsLoaded} rows`}
                  </p>
                )}
              </div>

              <h2 className="section-title">By currency and month</h2>
              <div className="card">
                <table className="stack-table">
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th>Month</th>
                      <th style={right}>Spend</th>
                      <th style={right}>Saved vs spot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={`${r.currency}-${r.month}`}>
                        <td data-label="Currency">{r.currency}</td>
                        <td data-label="Month">{String(r.month).slice(0, 7)}</td>
                        <td data-label="Spend" style={right}>
                          <Money amount={r.spendSgd} />
                        </td>
                        <td data-label="Saved vs spot" style={right}>
                          <Money amount={r.savedVsSpotSgd} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h2 className="section-title">Spend by category</h2>
              <div className="card">
                <table className="stack-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th style={right}>Spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((c) => (
                      <tr key={c.category}>
                        <td data-label="Category">{c.category}</td>
                        <td data-label="Spend" style={right}>
                          <Money amount={c.spendSgd} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  )
}
