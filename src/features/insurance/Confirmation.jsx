import { Link } from '@tanstack/react-router'
import { formatMoney } from './data'
import { getDraft, getPurchaseResult } from './storage'
import InsuranceLayout from './components/InsuranceLayout'

export default function Confirmation() {
  const purchase = getPurchaseResult()
  const draft = getDraft()
  if (!purchase) return <InsuranceLayout><div className="card"><h1>Purchase not found</h1><p className="muted">There is no recent insurance purchase to display.</p><Link to="/insurance">Browse plans</Link></div></InsuranceLayout>

  return <InsuranceLayout>
    <div className="card" style={{ textAlign: 'center', padding: 28 }}><div className="avatar" style={{ margin: '0 auto 14px', width: 52, height: 52, fontSize: 24 }}>✓</div><h1>Insurance purchase submitted</h1><p className="muted">The insurance service returned this purchase confirmation.</p></div>
    <div className="card"><div className="card-header"><h2>{draft.planName || 'Travel insurance'}</h2><span className="badge active">{purchase.status || 'Submitted'}</span></div>
      <div className="row-between"><span>Policy number</span><strong>{purchase.policyNumber || 'Pending'}</strong></div>
      <div className="row-between" style={{ marginTop: 8 }}><span>Purchase reference</span><strong>{purchase.purchaseId ?? '—'}</strong></div>
      <div className="row-between" style={{ marginTop: 8 }}><span>Destination</span><strong>{draft.trip?.destination} ({draft.trip?.destinationCode})</strong></div>
      <div className="row-between" style={{ marginTop: 8 }}><span>Premium</span><strong>{formatMoney(purchase.totalPremium, purchase.currencyCode)}</strong></div>
    </div>
    <div className="row"><Link to="/insurance/policies"><button>View My Insurance</button></Link><Link to="/insurance"><button className="secondary">Back to plans</button></Link></div>
  </InsuranceLayout>
}

