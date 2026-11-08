import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import AppShell from '../family/components/AppShell'
import { clearSession, isLoggedIn } from '../family/session'
import { usePageTitle } from '../../lib/usePageTitle'

// TODO: replace the manual box with Charles's trip list (see fx/FxHome.jsx and fx/queries.js).
export default function BudgetHome() {
  usePageTitle('Budget')
  const [tripId, setTripId] = useState('')
  const navigate = useNavigate()

  function signOut() {
    clearSession()
    navigate({ to: '/family' })
  }

  return (
    <AppShell onSignOut={isLoggedIn() ? signOut : undefined}>
      <h1>Budget</h1>
      <p className="muted">Open a trip to see spending against its category budgets.</p>
      <div className="card">
        <div className="field">
          <label htmlFor="budget-trip-id">Trip Id</label>
          <input
            id="budget-trip-id"
            type="number"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
          />
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
    </AppShell>
  )
}
