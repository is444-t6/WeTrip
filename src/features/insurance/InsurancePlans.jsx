import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { formatMoney, isValidTripDates, planLabel } from './data'
import { useInsurancePlans } from './queries'
import { getTrip } from './storage'
import Banner from '../family/components/Banner'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

function travellerLimit(maxTravellers) {
  return Number(maxTravellers) > 1 ? `Up to ${maxTravellers} people` : null
}

function coverageBadgeClass(coverageType) {
  const type = (coverageType || '').toLowerCase()
  if (type.includes('family')) return 'insurance-coverage-badge insurance-coverage-family'
  if (type.includes('individual')) return 'insurance-coverage-badge insurance-coverage-individual'
  return 'insurance-coverage-badge'
}

export default function InsurancePlans() {
  const navigate = useNavigate()
  const [compare, setCompare] = useState(false)
  const { data: plans = [], isLoading, error: plansError } = useInsurancePlans()
  const trip = getTrip()
  const highestCoverageByCurrency = new Map()
  for (const plan of plans) {
    const coverage = Number(plan.maxCoverageAmount)
    const currency = plan.currencyCode || 'SGD'
    if (
      Number.isFinite(coverage) &&
      (!highestCoverageByCurrency.has(currency) ||
        coverage > highestCoverageByCurrency.get(currency))
    ) {
      highestCoverageByCurrency.set(currency, coverage)
    }
  }
  const hasTrip = Boolean(
    trip.destination?.trim() &&
    /^[A-Za-z]{2}$/.test(trip.destinationCode || '') &&
    isValidTripDates(trip.startDate, trip.endDate),
  )

  return (
    <InsuranceLayout>
      <Link to="/insurance" className="muted">
        ← Edit destination details
      </Link>
      <h1 style={{ marginTop: 16, marginBottom: 6 }}>Choose an insurance plan</h1>
      <p className="muted">
        Compare plans for {trip.destination || 'your trip'} and select the cover that suits you.
      </p>
      <Notice />
      {!hasTrip && (
        <Banner kind="warn">
          Enter your destination and travel dates before choosing a plan.{' '}
          <Link to="/insurance">Add trip details</Link>
        </Banner>
      )}
      {hasTrip && (
        <div className="card">
          <div className="row-between">
            <strong>
              {trip.destination} ({trip.destinationCode.toUpperCase()})
            </strong>
            <span>
              {trip.startDate} – {trip.endDate}
            </span>
          </div>
        </div>
      )}
      <div className="row-between">
        <h2 className="section-title">Available plans</h2>
        <label className="row insurance-compare-toggle">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} />{' '}
          Compare plans
        </label>
      </div>
      {isLoading && <div className="card muted">Loading plans…</div>}
      {plansError && <Banner>Could not load insurance plans: {plansError.message}</Banner>}
      {compare && plans.length > 0 && (
        <section className="insurance-comparison card" aria-label="Compare insurance plans">
          <div className="insurance-comparison-heading">
            <div>
              <h2>Compare plans</h2>
              <p className="muted">Review coverage and plan details side by side.</p>
            </div>
            <span className="badge">
              {plans.length} {plans.length === 1 ? 'plan' : 'plans'}
            </span>
          </div>
          <div
            className="insurance-comparison-scroll"
            role="region"
            aria-label="Plan comparison table"
            tabIndex={0}
          >
            <table className="insurance-comparison-table">
              <thead>
                <tr>
                  <th scope="col" className="insurance-comparison-label">
                    Plan features
                  </th>
                  {plans.map((plan) => (
                    <th scope="col" key={plan.id}>
                      <span className="insurance-plan-name">{planLabel(plan)}</span>
                      <span className="insurance-plan-type">
                        {plan.coverageType || 'Travel cover'}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="insurance-comparison-label">
                    Maximum coverage
                  </th>
                  {plans.map((plan) => {
                    const currency = plan.currencyCode || 'SGD'
                    const isHighest =
                      Number(plan.maxCoverageAmount) === highestCoverageByCurrency.get(currency) &&
                      plans.filter((p) => (p.currencyCode || 'SGD') === currency).length > 1
                    return (
                      <td key={plan.id} className={isHighest ? 'insurance-highlight' : ''}>
                        {formatMoney(plan.maxCoverageAmount, currency)}
                        {isHighest && <span className="insurance-cell-note">Most cover</span>}
                      </td>
                    )
                  })}
                </tr>
                <tr>
                  <th scope="row" className="insurance-comparison-label">
                    Travellers covered
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.id}>{travellerLimit(plan.maxTravellers) || '—'}</td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="insurance-comparison-label">
                    Plan details
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.id} className="insurance-description">
                      {plan.description || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className="insurance-comparison-label">
                    Choose
                  </th>
                  {plans.map((plan) => (
                    <td key={plan.id}>
                      <button
                        type="button"
                        disabled={!hasTrip || !plan.isActive}
                        onClick={() =>
                          navigate({
                            to: '/insurance/plan/$planId',
                            params: { planId: String(plan.id) },
                          })
                        }
                      >
                        {plan.isActive ? 'Choose plan' : 'Unavailable'}
                      </button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="insurance-scroll-hint muted">
            On smaller screens, scroll sideways to compare all plans.
          </p>
        </section>
      )}
      {!compare &&
        plans.map((plan) => (
          <article className="card insurance-plan-card" key={plan.id}>
            <div className="insurance-plan-card-header">
              <div className="insurance-plan-heading">
                <h2 className="insurance-plan-card-title">{planLabel(plan)}</h2>
              </div>
              <div className="insurance-plan-header-coverage">
                <div className="insurance-plan-type-slot">
                  <span className={`badge ${coverageBadgeClass(plan.coverageType)}`}>
                    {plan.coverageType || 'Travel cover'}
                  </span>
                </div>
              </div>
            </div>
            {plan.description && <p className="insurance-plan-description">{plan.description}</p>}
            <div className="insurance-plan-facts">
              <div className="insurance-plan-fact">
                <span className="insurance-plan-detail-label">Maximum coverage</span>
                <strong>{formatMoney(plan.maxCoverageAmount, plan.currencyCode)}</strong>
              </div>
              {travellerLimit(plan.maxTravellers) && (
                <div className="insurance-plan-fact">
                  <span className="insurance-plan-detail-label">Travellers covered</span>
                  <strong>{travellerLimit(plan.maxTravellers)}</strong>
                </div>
              )}
            </div>
            <div className="insurance-plan-card-footer">
              <div className="row insurance-plan-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    navigate({
                      to: '/insurance/plan/$planId',
                      params: { planId: String(plan.id) },
                    })
                  }
                >
                  Plan details
                </button>
                <button
                  type="button"
                  disabled={!hasTrip || !plan.isActive}
                  onClick={() =>
                    navigate({
                      to: '/insurance/plan/$planId',
                      params: { planId: String(plan.id) },
                    })
                  }
                >
                  {plan.isActive ? 'Choose plan' : 'Unavailable'}
                </button>
              </div>
            </div>
          </article>
        ))}
      <Link to="/insurance/policies" className="muted">
        View My Insurance →
      </Link>
    </InsuranceLayout>
  )
}
