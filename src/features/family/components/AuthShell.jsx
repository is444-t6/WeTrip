import { useEffect } from 'react'
import { Brand } from './AppShell'

export default function AuthShell({ children }) {
  // Signing out swaps an AppShell page for this one without a full reload.
  useEffect(() => {
    document.getElementById('wetrip-main')?.focus()
  }, [])

  return (
    <main className="auth-page" id="wetrip-main" tabIndex={-1}>
      <div className="auth-shell">
        <div className="auth-brand">
          <Brand />
          <h1>
            one wallet,
            <br />
            <em>every adventure.</em>
          </h1>
          <p>
            WeTrip keeps the whole family moving — shared balances, smart budgets, allowances and a
            locked-in rate for every trip.
          </p>
          <div className="auth-features">
            <span>Family wallet</span>
            <span>Allowances & budgets</span>
            <span>SmartFX rate locks</span>
          </div>
        </div>
        <div className="auth-card">{children}</div>
      </div>
    </main>
  )
}
