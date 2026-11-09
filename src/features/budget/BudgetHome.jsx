import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import BudgetShell from './BudgetShell'
// TODO: replace the manual box with Charles's trip list (see fx/FxHome.jsx and fx/queries.js).
export default function BudgetHome() {
  const [tripId, setTripId] = useState('')
  const navigate = useNavigate()

  return (
    <BudgetShell>
      <h1 style={{ fontSize: '1.5rem', marginBottom: 6 }}>Budget</h1>
      <p className="muted">Open a trip to see spending against its category budgets.</p>
      <div className="card">
        <div className="field">
          <label htmlFor="tripId">Trip Id</label>
          <input id="tripId" type="number" value={tripId} onChange={(e) => setTripId(e.target.value)} />
        </div>
        <button
          type="button"
          disabled={!tripId}
          style={{ width: '100%' }}
          onClick={() => navigate({ to: '/budget/$tripId', params: { tripId } })}
        >
          Open budget
        </button>
      </div>
    </BudgetShell>
  )
}
