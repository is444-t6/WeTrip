import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { plans, formatSgd } from './data'
import { savePolicy } from './storage'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function Confirmation() {
  const [policy, setPolicy] = useState(null)
  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('wetrip.insurance.draft') || 'null')
      if (!draft || !draft.planId) return
      const existingId = sessionStorage.getItem('wetrip.insurance.confirmedDraft')
      if (existingId) { const found = JSON.parse(sessionStorage.getItem('wetrip.insurance.lastConfirmation') || 'null'); if (found) { setPolicy(found); return } }
      const plan = plans.find(p => p.id === draft.planId)
      const created = savePolicy({ ...draft, policyNumber: `DEMO-${Date.now().toString().slice(-8)}`, planName: plan?.name, purchasedAt: new Date().toISOString() })
      sessionStorage.setItem('wetrip.insurance.confirmedDraft', 'yes')
      sessionStorage.setItem('wetrip.insurance.lastConfirmation', JSON.stringify(created))
      setPolicy(created)
    } catch { /* Keep the confirmation page safe if browser storage is unavailable. */ }
  }, [])
  return <InsuranceLayout><div className="card" style={{ textAlign: 'center', padding: 28 }}><div className="avatar" style={{ margin: '0 auto 14px', width: 52, height: 52, fontSize: 24 }}>✓</div><h1>Demo purchase confirmed</h1><p className="muted">This is a simulated confirmation only. No payment was taken and no insurance policy was issued.</p></div><Notice />{policy && <div className="card"><div className="card-header"><h2>{policy.planName}</h2><span className="badge pending">Demo only</span></div><div className="row-between"><span>Reference</span><strong>{policy.policyNumber}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Destination</span><strong>{policy.trip.destination}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Premium</span><strong>{formatSgd(policy.total)}</strong></div></div>}<div className="row"><Link to="/insurance/policies"><button>View My Insurance</button></Link><Link to="/insurance"><button className="secondary">Back to plans</button></Link></div></InsuranceLayout>
}
