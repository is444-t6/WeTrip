import { useState } from 'react'
import { clearSession, isLoggedIn } from '../auth/session'
import AppShell from '../../components/AppShell'
import Banner from '../../components/Banner'
import Money from '../../components/Money'
import SignedOutCard from '../../components/SignedOutCard'
import { useInsights, useRunEtlNow } from './queries'
import { HBars, Meter, MonthBars } from './Charts'
import { PERIODS, currenciesIn, keep, monthSeries, periodStart, totalsBy } from './insightsData'

// OutSystems sends 1900-01-01 for an empty date.
const when = (value) => {
  const d = new Date(value)
  return d.getFullYear() > 1900
    ? d.toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })
    : null
}
const right = { textAlign: 'right' }
// This month in Singapore, as 'YYYY-MM'.
const thisMonth = () => new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 7)

// Internal page, reached by URL only. Everything comes from the analytics data mart
// (WeTrip_Analytics_Composite): aggregates, never customer data. The currency and
// period filters apply to the headline and every chart; the trip, over-budget and
// pay-later tiles are all-time totals the mart does not split.
export default function Insights() {
  const { data, error, isLoading } = useInsights()
  const refresh = useRunEtlNow()
  const [currency, setCurrency] = useState('all')
  const [period, setPeriod] = useState('all')

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
  const updated = when(data?.lastSuccessOn)
  // Counts of the run this page started, once it has finished.
  const finished = refresh.data && run.etlRunId === refresh.data.etlRunId && !busy

  const filter = { currency, start: periodStart(period, thisMonth()) }
  const filtered = rows.filter((r) => keep(r, filter))
  const series = monthSeries(filtered)
  const spend = filtered.reduce((s, r) => s + (Number(r.spendSgd) || 0), 0)
  // Unfiltered, the headline is the server's own total.
  const saved =
    currency === 'all' && period === 'all'
      ? Number(data?.savedVsSpotSgd) || 0
      : filtered.reduce((s, r) => s + (Number(r.savedVsSpotSgd) || 0), 0)
  const byCategory = totalsBy(
    categories.filter((c) => keep(c, filter)),
    'category',
  )
  const byCurrency = totalsBy(filtered, 'currency')
  // OutSystems can't send null: no completed trip with category limits arrives as 0 eligible trips.
  const eligible = Number(data?.overBudgetEligibleTrips) > 0
  const pct = Math.round(Number(data?.overBudgetTripPct) || 0)

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
              <div className="chips" role="group" aria-label="Currency">
                {['all', ...currenciesIn([...rows, ...categories])].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`chip ${currency === c ? 'active' : ''}`}
                    aria-pressed={currency === c}
                    onClick={() => setCurrency(c)}
                  >
                    {c === 'all' ? 'All currencies' : c}
                  </button>
                ))}
              </div>
              <div className="segmented" role="group" aria-label="Period">
                {PERIODS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={period === p.id ? 'active' : ''}
                    aria-pressed={period === p.id}
                    onClick={() => setPeriod(p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="card">
                <h2 style={{ margin: 0 }}>
                  {saved < 0 ? 'Locking cost families' : 'Locking saved families'}{' '}
                  <Money amount={Math.abs(saved)} />
                </h2>
                <p className="muted" style={{ margin: '6px 0 0' }}>
                  <Money amount={spend} /> spent
                  {currency !== 'all' && ` in ${currency}`}
                </p>
                {updated && (
                  <p className="muted" style={{ margin: '8px 0 0', fontSize: '0.8rem' }}>
                    Last updated {updated}
                    {run.status === 'Success' && ` · ${run.rowsLoaded} rows`}
                  </p>
                )}
              </div>

              <h2 className="section-title">Saved vs spot by month</h2>
              <div className="card">
                <MonthBars
                  label="Saved versus spot rate by month, in SGD"
                  points={series.map((p) => ({ month: p.month, value: p.saved }))}
                  caption="Above the line, locking beat the day's spot rate; below it (red), spot would have been cheaper. Spends before the first rate snapshot count as zero."
                />
              </div>

              <h2 className="section-title">Spend by month</h2>
              <div className="card">
                <MonthBars
                  label="Spend by month, in SGD"
                  points={series.map((p) => ({ month: p.month, value: p.spend }))}
                />
                <details style={{ marginTop: 10 }}>
                  <summary className="muted">Show as table</summary>
                  <table className="stack-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th style={right}>Spend</th>
                        <th style={right}>Saved vs spot</th>
                      </tr>
                    </thead>
                    <tbody>
                      {series.map((p) => (
                        <tr key={p.month}>
                          <td data-label="Month">{p.month}</td>
                          <td data-label="Spend" style={right}>
                            <Money amount={p.spend} />
                          </td>
                          <td data-label="Saved vs spot" style={right}>
                            <Money amount={p.saved} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </div>

              <h2 className="section-title">Spend by category</h2>
              <div className="card">
                <HBars items={byCategory} label="Spend by category, in SGD" />
              </div>

              {currency === 'all' && byCurrency.length > 1 && (
                <>
                  <h2 className="section-title">Spend by currency</h2>
                  <div className="card">
                    <HBars items={byCurrency} label="Spend by trip currency, in SGD" />
                  </div>
                </>
              )}

              <h2 className="section-title">All trips, all time</h2>
              <div className="card stack" style={{ gap: 14 }}>
                <div>
                  <p style={{ margin: '0 0 6px' }}>
                    {eligible ? `${pct}%` : '—'} of completed trips went over budget
                  </p>
                  {eligible && (
                    <Meter pct={pct} label={`${pct}% of completed trips went over budget`} />
                  )}
                </div>
                <p style={{ margin: 0 }}>
                  {data.tripsCount} {Number(data.tripsCount) === 1 ? 'trip' : 'trips'} in the mart
                </p>
                <p style={{ margin: 0 }}>
                  Pay later: {data.bnpl?.plans ?? 0} plans ·{' '}
                  <Money amount={data.bnpl?.principalSgd} />
                </p>
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  )
}
