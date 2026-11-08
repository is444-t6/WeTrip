export default function RateGauge({ current, target, currency }) {
  const cur = Number(current) || 0
  const tgt = Number(target) || 0
  const pct = tgt ? Math.min(100, (cur / tgt) * 100) : 0
  const hit = tgt > 0 && cur >= tgt

  return (
    <div className="card rate-watch">
      <div className="card-header">
        <h2>Rate watch</h2>
        <span className={`badge ${hit ? 'active' : 'pending'}`}>
          {hit ? 'target hit' : 'watching'}
        </span>
      </div>

      <div className="rate-big">
        {cur ? cur.toFixed(4) : '—'} <small>{currency} per SGD</small>
      </div>

      <div className="progress" style={{ marginTop: 16 }}>
        <div style={{ width: `${pct}%` }} />
      </div>

      <div className="row-between muted" style={{ fontSize: '0.85em', marginTop: 8 }}>
        <span>
          Target {tgt ? tgt.toFixed(4) : '—'} {currency}
        </span>
        <span>{hit ? 'auto-lock condition met' : `${Math.max(0, pct).toFixed(0)}% of target`}</span>
      </div>
    </div>
  )
}
