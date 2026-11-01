import { Link } from '@tanstack/react-router'
import { plans, formatSgd } from './data'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function Checkout() {
  const draft = readDraft()
  const plan = plans.find(p => p.id === draft.planId)
  if (!draft.planId || !plan) return <InsuranceLayout><div className="card">Your checkout details are missing. <Link to="/insurance">Start again</Link>.</div></InsuranceLayout>
  return <InsuranceLayout><Link to="/insurance/travellers" search={{ planId: draft.planId }} className="muted">← Edit traveller details</Link><h1 style={{ marginTop: 16 }}>Checkout summary</h1><p className="muted">Review your illustrative selection before simulating purchase.</p><Notice />
    <div className="card"><div className="card-header"><h2>Trip</h2><span className="badge pending">Optional cover</span></div><div className="row-between"><span>Destination</span><strong>{draft.trip?.destination}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Travel dates</span><strong>{draft.trip?.startDate} – {draft.trip?.endDate}</strong></div></div>
    <div className="card"><h2 style={{ marginBottom: 14 }}>Selected plan</h2><div className="row-between"><strong>{plan.name} · {draft.coverType === 'family' ? 'Family' : 'Individual'}</strong><strong>{draft.travellers?.length} traveller(s)</strong></div><p className="muted" style={{ marginTop: 10 }}>Travellers: {draft.travellers?.map(t => t.name).join(', ')}</p><p className="muted">Contact: {draft.email}</p><hr style={{ border: 0, borderTop: '1px solid var(--card-border)', margin: '16px 0' }} /><div className="row-between"><span>Premium ({draft.travellers?.length} × {formatSgd(plan.premium)})</span><strong className="money">{formatSgd(draft.total)}</strong></div><p className="muted" style={{ marginTop: 12 }}>No payment will be taken. This button records a demo confirmation in this browser only.</p></div>
    <Link to="/insurance/confirmation"><button style={{ width: '100%' }}>Simulate successful purchase</button></Link>
  </InsuranceLayout>
}
function readDraft() { try { return JSON.parse(sessionStorage.getItem('wetrip.insurance.draft') || '{}') } catch { return {} } }
