import { money } from '../../../lib/format'

const BAR = {
  OK: undefined, // default mint from .progress
  WARNING: '#f0b35c',
  OVER: 'var(--coral)',
}
const BADGE = { OK: 'active', WARNING: 'pending', OVER: 'removed' }
const LABEL = { WARNING: 'Near limit', OVER: 'Over' }

export default function BudgetBars({ lines }) {
  if (!lines?.length) {
    return (
      <div className="card">
        <p className="muted">No category budgets yet. A parent can set them below.</p>
      </div>
    )
  }
  return (
    <div className="card">
      {lines.map((l) => {
        const pct = Math.max(0, Math.min(Number(l.percentUsed) || 0, 100))
        return (
          <div key={l.categoryId} style={{ marginBottom: 14 }}>
            <div className="row-between budget-line">
              <strong>{l.categoryName}</strong>
              <span className="row">
                {l.alertLevel !== 'OK' && (
                  <span className={`badge ${BADGE[l.alertLevel] ?? ''}`}>
                    {LABEL[l.alertLevel] ?? l.alertLevel}
                  </span>
                )}
                <span className="money">
                  {money(l.spentAmount)} / {money(l.limitAmount)}
                </span>
              </span>
            </div>
            <div className="progress">
              <div style={{ width: `${pct}%`, background: BAR[l.alertLevel] }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
