import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { formatMoney, formatDate, planLabel } from './data'
import { useInsurancePlans, useMyInsurance } from './queries'
import InsuranceLayout from './components/InsuranceLayout'

function travellerInitials(name) {
  return (name || 'Traveller')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('')
}

export default function MyInsurance() {
  const policies = useMyInsurance()
  const plans = useInsurancePlans()
  const planById = new Map((plans.data || []).map(p => [String(p.id), p]))
  const items = policies.data || []
  const [expandedPolicies, setExpandedPolicies] = useState({})

  function togglePolicy(policyKey) {
    setExpandedPolicies(current => ({ ...current, [policyKey]: !current[policyKey] }))
  }

  return <InsuranceLayout>
    <h1 style={{ fontSize: '1.5rem' }}>My Insurance</h1>
    <p className="muted">Policies returned by the insurance service.</p>
    {policies.isLoading && <div className="card muted">Loading your policies…</div>}
    {policies.error && <div className="banner error">Could not load your policies: {policies.error.message}</div>}
    {policies.isSuccess && items.length === 0 && <div className="card empty">No insurance policies were returned.<div style={{ marginTop: 14 }}><Link to="/insurance"><button>Explore plans</button></Link></div></div>}
    {items.map(p => {
      const plan = planById.get(String(p.insurancePlanId))
      const isExpired = String(p.status || '').trim().toLowerCase() === 'expired'
      const policyKey = p.purchaseId ?? p.policyNumber ?? `${p.insurancePlanId}-${p.coverageStart}`
      const isExpanded = Boolean(expandedPolicies[policyKey])
      const travellers = p.travellers || p.coveredTravellers || p.insuredPersons || []
      return <section className="card insurance-policy-card" key={policyKey}>
        <button
          type="button"
          className="insurance-policy-summary"
          aria-expanded={isExpanded}
          aria-controls={`policy-details-${policyKey}`}
          onClick={() => togglePolicy(policyKey)}
        >
          <div className="insurance-policy-title">
            <span className={`badge ${isExpired ? 'removed' : 'active'}`}>{p.status || 'Policy'}</span>
            <h2>{plan ? planLabel(plan) : `Plan ${p.insurancePlanId}`}</h2>
            <span className="muted">Policy number: {p.policyNumber || '—'}</span>
            <span className="muted">Coverage: {formatDate(p.coverageStart)} – {formatDate(p.coverageEnd)}</span>
          </div>
          <span className="insurance-policy-expand">{isExpanded ? 'Hide details −' : 'More information +'}</span>
        </button>
        {isExpanded && <div className="insurance-policy-details" id={`policy-details-${policyKey}`}>
          <div className="insurance-covered-heading">
            <div>
              <h3>Who is covered</h3>
              <p className="muted">People insured under this policy</p>
            </div>
            {travellers.length > 0 && <span className="badge">{travellers.length} {travellers.length === 1 ? 'traveller' : 'travellers'}</span>}
          </div>
          {travellers.length > 0
            ? <ul className="insurance-covered-travellers">
              {travellers.map((traveller, index) => {
                const name = traveller.fullName || traveller.name || 'Traveller'
                return <li key={traveller.travellerId ?? traveller.id ?? `${name}-${index}`}>
                  <span className="insurance-traveller-avatar" aria-hidden="true">{travellerInitials(name)}</span>
                  <span className="insurance-traveller-info">
                    <strong>{name}</strong>
                    {traveller.dateOfBirth && <span className="muted">Date of birth · {formatDate(traveller.dateOfBirth)}</span>}
                    {traveller.nationalityCode && <span className="muted">Nationality · {traveller.nationalityCode}</span>}
                  </span>
                  <span className="badge active">Covered</span>
                </li>
              })}
            </ul>
            : <div className="insurance-covered-empty">
              <span className="insurance-covered-empty-icon" aria-hidden="true">i</span>
              <span><strong>Traveller details unavailable</strong><small className="muted">The insurance service did not return the covered people for this policy.</small></span>
            </div>}
          <div className="insurance-policy-extra" aria-label="Purchase details">
            <div className="insurance-policy-detail">
              <span className="insurance-detail-label">Destination</span>
              <strong>{p.destinationCode || '—'}</strong>
            </div>
            <div className="insurance-policy-detail">
              <span className="insurance-detail-label">Premium paid</span>
              <strong className="money">{formatMoney(p.totalPremium, p.currencyCode)}</strong>
            </div>
            <div className="insurance-policy-detail">
              <span className="insurance-detail-label">Purchased</span>
              <strong>{formatDate(p.purchasedOn)}</strong>
            </div>
          </div>
        </div>}
      </section>
    })}
    <Link to="/insurance"><button className="secondary" style={{ width: '100%' }}>Explore plans</button></Link>
  </InsuranceLayout>
}
