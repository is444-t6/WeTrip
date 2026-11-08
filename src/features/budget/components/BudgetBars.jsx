const BAR = {
  OK: undefined, // default green from .progress
  WARNING: 'linear-gradient(90deg, var(--warn), #f0b35c)',
  OVER: 'linear-gradient(90deg, var(--danger), #ff7a6e)',
}
const BADGE = { OK: 'active', WARNING: 'pending', OVER: 'removed' }

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
            <div className="row-between">
              <strong>{l.categoryName}</strong>
              <span className="row">
                {l.alertLevel !== 'OK' && (
                  <span className={`badge ${BADGE[l.alertLevel] ?? ''}`}>{l.alertLevel}</span>
                )}
                <span className="money">
                  {Number(l.spentAmount ?? 0).toFixed(2)} / {Number(l.limitAmount ?? 0).toFixed(2)}
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
