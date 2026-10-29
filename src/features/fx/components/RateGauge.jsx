export default function RateGauge({ current, target, currency }) {
  const cur = Number(current) || 0
  const tgt = Number(target) || 0
  const pct = tgt ? Math.min(100, (cur / tgt) * 100) : 0
  const hit = tgt > 0 && cur >= tgt

  return (
    <div className="card">
      <div className="card-header">
        <h3>Rate watch</h3>
        <span className={`badge ${hit ? 'active' : 'pending'}`}>{hit ? 'target hit' : 'watching'}</span>
      </div>

      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="muted">1 SGD</span>
        <span className="money">
          {cur ? cur.toFixed(4) : '—'} {currency}
        </span>
      </div>

      <div className="progress">
        <div style={{ width: `${pct}%` }} />
      </div>

      <div className="row-between muted" style={{ fontSize: '0.82em', marginTop: 6 }}>
        <span>Target {tgt ? tgt.toFixed(4) : '—'} {currency}</span>
        <span>{hit ? 'auto-lock condition met' : `${Math.max(0, pct).toFixed(0)}% of target`}</span>
      </div>
    </div>
  )
}
