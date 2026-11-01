import { Link, useParams } from '@tanstack/react-router'
import { plans, formatSgd } from './data'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function PlanDetails() {
  const { planId } = useParams({ from: '/insurance/plan/$planId' })
  const plan = plans.find(p => p.id === planId)
  if (!plan) return <InsuranceLayout><div className="card">Plan not found. <Link to="/insurance">Back to plans</Link></div></InsuranceLayout>
  return <InsuranceLayout>
    <Link to="/insurance" className="muted">← Back to plans</Link>
    <div style={{ marginTop: 16 }}><Notice /></div>
    <div className="card"><span className="badge active">{plan.tier}</span><h1 style={{ marginTop: 8 }}>{plan.name}</h1><p className="muted">{plan.summary}</p><strong className="money">{formatSgd(plan.premium)} per traveller</strong></div>
    <div className="section-title">Coverage overview</div><div className="card">{Object.entries({ 'Overseas medical': 'medical', 'Trip cancellation': 'cancellation', 'Baggage': 'baggage', 'Travel delay': 'delay' }).map(([label, key]) => <div className="row-between" key={key} style={{ padding: '8px 0', borderBottom: '1px solid var(--card-border)' }}><span>{label}</span><strong>{formatSgd(plan.benefits[key])}</strong></div>)}</div>
    <div className="section-title">Included benefits</div><div className="card"><ul>{plan.details.map(x => <li key={x} style={{ marginBottom: 8 }}>{x}</li>)}</ul></div>
    <div className="section-title">Key exclusions</div><div className="card"><ul>{plan.exclusions.map(x => <li key={x} style={{ marginBottom: 8 }}>{x}</li>)}</ul><p className="muted">This is a summary for a prototype. It is not full policy wording.</p></div>
    <Link to="/insurance/travellers" search={{ planId }}><button style={{ width: '100%' }}>Choose this plan</button></Link>
  </InsuranceLayout>
}
