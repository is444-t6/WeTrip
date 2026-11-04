import { Link, useParams } from '@tanstack/react-router'
import { formatMoney, planLabel } from './data'
import { useInsurancePlans } from './queries'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function PlanDetails() {
  const { planId } = useParams({ from: '/insurance/plan/$planId' })
  const { data: plans = [], isLoading, error } = useInsurancePlans()
  const plan = plans.find(p => String(p.id) === String(planId))

  if (isLoading) return <InsuranceLayout><div className="card muted">Loading plan…</div></InsuranceLayout>
  if (error) return <InsuranceLayout><div className="card"><div className="banner error">Could not load plans: {error.message}</div><Link to="/insurance/plans">Back to plans</Link></div></InsuranceLayout>
  if (!plan) return <InsuranceLayout><div className="card">Plan not found. <Link to="/insurance/plans">Back to plans</Link></div></InsuranceLayout>

  return <InsuranceLayout>
    <Link to="/insurance/plans" className="muted">← Back to plans</Link>
    <div style={{ marginTop: 16 }}><Notice /></div>
    <div className="card"><span className="badge active">{plan.coverageType || 'Travel cover'}</span><h1 style={{ marginTop: 8 }}>{planLabel(plan)}</h1><p className="muted">{plan.description}</p><strong className="money">{formatMoney(plan.premiumPerDay, plan.currencyCode)} per day</strong></div>
    <div className="section-title">Plan information</div>
    <div className="card">
      <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}><span>Maximum coverage</span><strong>{formatMoney(plan.maxCoverageAmount, plan.currencyCode)}</strong></div>
      <div className="row-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}><span>Maximum travellers</span><strong>{plan.maxTravellers ?? '—'}</strong></div>
      <div className="row-between" style={{ padding: '8px 0' }}><span>Availability</span><strong>{plan.isActive ? 'Available' : 'Unavailable'}</strong></div>
    </div>
    {plan.isActive
      ? <Link to="/insurance/travellers" search={{ planId: String(plan.id) }}><button style={{ width: '100%' }}>Choose this plan</button></Link>
      : <div className="banner">This plan is currently unavailable.</div>}
  </InsuranceLayout>
}
