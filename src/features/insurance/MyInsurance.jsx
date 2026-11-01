import { Link } from '@tanstack/react-router'
import { getPolicies } from './storage'
import { formatSgd } from './data'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function MyInsurance() {
  const policies = getPolicies()
  return <InsuranceLayout><h1 style={{ fontSize: '1.5rem' }}>My Insurance</h1><p className="muted">Your simulated purchases on this browser.</p><Notice />{policies.length === 0 ? <div className="card empty">No demo purchases yet.<div style={{ marginTop: 14 }}><Link to="/insurance"><button>Explore plans</button></Link></div></div> : policies.map(p => <div className="card" key={p.policyNumber}><div className="card-header"><div><span className="badge pending">Demo policy</span><h2 style={{ marginTop: 8 }}>{p.planName} · {p.coverType === 'family' ? 'Family' : 'Individual'}</h2></div><strong className="money">{formatSgd(p.total)}</strong></div><div className="row-between"><span>Reference</span><strong>{p.policyNumber}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Destination</span><strong>{p.trip?.destination}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Travel dates</span><strong>{p.trip?.startDate} – {p.trip?.endDate}</strong></div><div className="row-between" style={{ marginTop: 8 }}><span>Travellers</span><strong>{p.travellers?.map(t => t.name).join(', ')}</strong></div></div>)}<Link to="/insurance"><button className="secondary" style={{ width: '100%' }}>Explore plans</button></Link></InsuranceLayout>
}
