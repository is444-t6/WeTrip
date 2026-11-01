import { useState } from 'react'
import { Link, useSearch } from '@tanstack/react-router'
import { plans, formatSgd } from './data'
import Notice from './components/Notice'
import InsuranceLayout from './components/InsuranceLayout'

export default function InsuranceHome() {
  const search = useSearch({ from: '/insurance/' })
  const [destination, setDestination] = useState(search.destination || '')
  const [startDate, setStartDate] = useState(search.startDate || '')
  const [endDate, setEndDate] = useState(search.endDate || '')
  const [compare, setCompare] = useState(false)
  const [error, setError] = useState('')
  const trip = { destination, startDate, endDate }

  function continueTo(planId) {
    if (!destination.trim() || !startDate || !endDate || endDate < startDate) {
      setError('Enter a destination and valid travel dates before choosing a plan.')
      return
    }
    window.sessionStorage.setItem('wetrip.insurance.trip', JSON.stringify(trip))
    window.location.href = `/insurance/plan/${planId}`
  }

  return <InsuranceLayout>
    <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>Travel insurance</h1>
    <p className="muted">Add optional cover to your trip. Compare plans and choose what suits your travellers.</p>
    <Notice />
    <div className="section-title">Your trip</div>
    <div className="card">
      {error && <div className="banner error">{error}</div>}
      <div className="field"><label htmlFor="destination">Destination</label><input id="destination" value={destination} onChange={e => { setDestination(e.target.value); persistTrip({ destination: e.target.value, startDate, endDate }) }} placeholder="e.g. Tokyo, Japan" required /></div>
      <div className="grid-2">
        <div className="field"><label htmlFor="start">Depart</label><input id="start" type="date" value={startDate} onChange={e => { setStartDate(e.target.value); persistTrip({ destination, startDate: e.target.value, endDate }) }} required /></div>
        <div className="field"><label htmlFor="end">Return</label><input id="end" type="date" min={startDate} value={endDate} onChange={e => { setEndDate(e.target.value); persistTrip({ destination, startDate, endDate: e.target.value }) }} required /></div>
      </div>
    </div>
    <div className="row-between"><div className="section-title">Choose a plan</div><label className="row" style={{ margin: 0 }}><input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} style={{ width: 'auto' }} /> Compare</label></div>
    {compare && <div className="card" style={{ overflowX: 'auto' }}><table><thead><tr><th>Benefit</th>{plans.map(p => <th key={p.id}>{p.name}</th>)}</tr></thead><tbody>{[['Medical', 'medical'], ['Cancellation', 'cancellation'], ['Baggage', 'baggage'], ['Travel delay', 'delay']].map(([label, key]) => <tr key={key}><td>{label}</td>{plans.map(p => <td key={p.id}>{formatSgd(p.benefits[key])}</td>)}</tr>)}</tbody></table></div>}
    {plans.map(plan => <div className="card" key={plan.id}>
      <div className="card-header"><div><span className="badge active">{plan.tier}</span><h2 style={{ marginTop: 8 }}>{plan.name}</h2></div><strong className="money">{formatSgd(plan.premium)}<span className="muted" style={{ fontWeight: 400 }}> / traveller</span></strong></div>
      <p className="muted">{plan.summary}</p>
      <div className="row-between"><span>Medical cover</span><strong>{formatSgd(plan.benefits.medical)}</strong></div>
      <div className="row-between" style={{ marginTop: 8 }}><span>Cancellation</span><strong>{formatSgd(plan.benefits.cancellation)}</strong></div>
      <div className="row" style={{ marginTop: 16 }}><Link to="/insurance/plan/$planId" params={{ planId: plan.id }}><button className="secondary">Details & exclusions</button></Link><button onClick={() => continueTo(plan.id)}>Choose plan</button></div>
    </div>)}
    <Link to="/insurance/policies" className="muted">View My Insurance →</Link>
  </InsuranceLayout>
}

function persistTrip(trip) { sessionStorage.setItem('wetrip.insurance.trip', JSON.stringify(trip)) }
