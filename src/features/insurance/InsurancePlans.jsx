import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlans } from './queries'
import { getTrip } from './storage'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function InsurancePlans() {
  const [compare, setCompare] = useState(false)
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const trip = getTrip()
  const cheapestByCurrency = new Map()
  const highestCoverageByCurrency = new Map()
  for (const plan of plans) {
    const premium = Number(plan.premiumPerDay)
    const coverage = Number(plan.maxCoverageAmount)
    const currency = plan.currencyCode || 'SGD'
    if (Number.isFinite(premium) && (!cheapestByCurrency.has(currency) || premium < cheapestByCurrency.get(currency))) {
      cheapestByCurrency.set(currency, premium)
    }
    if (Number.isFinite(coverage) && (!highestCoverageByCurrency.has(currency) || coverage > highestCoverageByCurrency.get(currency))) {
      highestCoverageByCurrency.set(currency, coverage)
    }
  }
  const hasTrip = Boolean(
    trip.destination?.trim()
    && /^[A-Za-z]{2}$/.test(trip.destinationCode || '')
    && trip.startDate
    && trip.endDate
    && trip.endDate >= trip.startDate,
  )

  return <InsuranceLayout>
    <Link to="/insurance" className="muted">← Edit destination details</Link>
    <h1 style={{ fontSize: '1.5rem', marginTop: 16, marginBottom: 6 }}>Choose an insurance plan</h1>
    <p className="muted">Compare plans for {trip.destination || 'your trip'} and select the cover that suits you.</p>
    <Notice />
    {!hasTrip && <div className="banner">Enter your destination and travel dates before choosing a plan. <Link to="/insurance">Add trip details</Link></div>}
    {hasTrip && <div className="card">
      <div className="row-between"><strong>{trip.destination} ({trip.destinationCode.toUpperCase()})</strong><span>{trip.startDate} – {trip.endDate}</span></div>
    </div>}
    <div className="row-between"><div className="section-title">Available plans</div><label className="row insurance-compare-toggle"><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} /> Compare plans</label></div>
    {isLoading && <div className="card muted">Loading plans…</div>}
    {plansError && <div className="banner error">Could not load insurance plans: {plansError.message}</div>}
    {compare && plans.length > 0 && <section className="insurance-comparison card" aria-label="Compare insurance plans">
      <div className="insurance-comparison-heading">
        <div><h2>Compare plans</h2><p className="muted">Review cover and cost side by side.</p></div>
        <span className="badge">{plans.length} {plans.length === 1 ? 'plan' : 'plans'}</span>
      </div>
      <div className="insurance-comparison-scroll" role="region" aria-label="Plan comparison table" tabIndex={0}>
        <table className="insurance-comparison-table">
          <thead><tr><th scope="col" className="insurance-comparison-label">Plan features</th>{plans.map(plan => {
            const currency = plan.currencyCode || 'SGD'
            const isCheapest = Number(plan.premiumPerDay) === cheapestByCurrency.get(currency) && plans.filter(p => (p.currencyCode || 'SGD') === currency).length > 1
            return <th scope="col" key={plan.id}>
              {isCheapest && <span className="insurance-best-value">Lowest price</span>}
              <span className="insurance-plan-name">{planLabel(plan)}</span>
              <span className="insurance-plan-type">{plan.coverageType || 'Travel cover'}</span>
            </th>
          })}</tr></thead>
          <tbody>
            <tr><th scope="row" className="insurance-comparison-label">Premium per day</th>{plans.map(plan => {
              const currency = plan.currencyCode || 'SGD'
              const isCheapest = Number(plan.premiumPerDay) === cheapestByCurrency.get(currency) && plans.filter(p => (p.currencyCode || 'SGD') === currency).length > 1
              return <td key={plan.id} className={isCheapest ? 'insurance-highlight' : ''}><strong className="money">{formatMoney(plan.premiumPerDay, currency)}</strong><span className="insurance-cell-note">per day</span></td>
            })}</tr>
            <tr><th scope="row" className="insurance-comparison-label">Maximum coverage</th>{plans.map(plan => {
              const currency = plan.currencyCode || 'SGD'
              const isHighest = Number(plan.maxCoverageAmount) === highestCoverageByCurrency.get(currency) && plans.filter(p => (p.currencyCode || 'SGD') === currency).length > 1
              return <td key={plan.id} className={isHighest ? 'insurance-highlight' : ''}>{formatMoney(plan.maxCoverageAmount, currency)}{isHighest && <span className="insurance-cell-note">Most cover</span>}</td>
            })}</tr>
            <tr><th scope="row" className="insurance-comparison-label">Maximum travellers</th>{plans.map(plan => <td key={plan.id}>{plan.maxTravellers ?? '—'}</td>)}</tr>
            <tr><th scope="row" className="insurance-comparison-label">Plan details</th>{plans.map(plan => <td key={plan.id} className="insurance-description">{plan.description || '—'}</td>)}</tr>
            <tr><th scope="row" className="insurance-comparison-label">Choose</th>{plans.map(plan => <td key={plan.id}>
              <Link to="/insurance/plan/$planId" params={{ planId: String(plan.id) }}><button disabled={!hasTrip || !plan.isActive}>{plan.isActive ? 'Choose plan' : 'Unavailable'}</button></Link>
            </td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="insurance-scroll-hint muted">On smaller screens, scroll sideways to compare all plans.</p>
    </section>}
    {!compare && plans.map(plan => <div className="card" key={plan.id}>
      <div className="card-header"><div><span className="badge active">{plan.coverageType || 'Travel cover'}</span><h2 style={{ marginTop: 8 }}>{planLabel(plan)}</h2></div><strong className="money">{formatMoney(plan.premiumPerDay, plan.currencyCode)}<span className="muted" style={{ fontWeight: 400 }}> / day</span></strong></div>
      <p className="muted">{plan.description}</p>
      <div className="row-between"><span>Maximum coverage</span><strong>{formatMoney(plan.maxCoverageAmount, plan.currencyCode)}</strong></div>
      <div className="row-between" style={{ marginTop: 8 }}><span>Maximum travellers</span><strong>{plan.maxTravellers ?? '—'}</strong></div>
      <div className="row" style={{ marginTop: 16 }}><Link to="/insurance/plan/$planId" params={{ planId: String(plan.id) }}><button className="secondary">Plan details</button></Link><Link to="/insurance/plan/$planId" params={{ planId: String(plan.id) }}><button disabled={!hasTrip || !plan.isActive}>{plan.isActive ? 'Choose plan' : 'Unavailable'}</button></Link></div>
    </div>)}
    <Link to="/insurance/policies" className="muted">View My Insurance →</Link>
  </InsuranceLayout>
}
