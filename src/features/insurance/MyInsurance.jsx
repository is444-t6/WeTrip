import { Link } from '@tanstack/react-router'
import { formatMoney, formatDate, planLabel } from './data'
import { useInsurancePlans, useMyInsurance } from './queries'
import InsuranceLayout from './components/InsuranceLayout'

export default function MyInsurance() {
  const policies = useMyInsurance()
  const plans = useInsurancePlans()
  const planById = new Map((plans.data || []).map(p => [String(p.id), p]))
  const items = policies.data || []

  return <InsuranceLayout>
    <h1 style={{ fontSize: '1.5rem' }}>My Insurance</h1>
    <p className="muted">Policies returned by the insurance service.</p>
    {policies.isLoading && <div className="card muted">Loading your policies…</div>}
    {policies.error && <div className="banner error">Could not load your policies: {policies.error.message}</div>}
    {policies.isSuccess && items.length === 0 && <div className="card empty">No insurance policies were returned.<div style={{ marginTop: 14 }}><Link to="/insurance"><button>Explore plans</button></Link></div></div>}
    {items.map(p => {
      const plan = planById.get(String(p.insurancePlanId))
      const isExpired = String(p.status || '').trim().toLowerCase() === 'expired'
      return <div className="card" key={p.purchaseId ?? p.policyNumber}>
        <div className="card-header"><div><span className={`badge ${isExpired ? 'removed' : 'active'}`}>{p.status || 'Policy'}</span><h2 style={{ marginTop: 8 }}>{plan ? planLabel(plan) : `Plan ${p.insurancePlanId}`}</h2></div><strong className="money">{formatMoney(p.totalPremium, p.currencyCode)}</strong></div>
        <div className="row-between"><span>Policy number</span><strong>{p.policyNumber || '—'}</strong></div>
        <div className="row-between" style={{ marginTop: 8 }}><span>Destination</span><strong>{p.destinationCode || '—'}</strong></div>
        <div className="row-between" style={{ marginTop: 8 }}><span>Coverage dates</span><strong>{formatDate(p.coverageStart)} – {formatDate(p.coverageEnd)}</strong></div>
        <div className="row-between" style={{ marginTop: 8 }}><span>Purchased</span><strong>{formatDate(p.purchasedOn)}</strong></div>
      </div>
    })}
    <Link to="/insurance"><button className="secondary" style={{ width: '100%' }}>Explore plans</button></Link>
  </InsuranceLayout>
}
