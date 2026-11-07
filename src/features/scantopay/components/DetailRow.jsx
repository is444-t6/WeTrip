export default function DetailRow({ label, children }) {
  return (
    <div className="row-between">
      <span className="muted">{label}</span>
      <span className="money" style={{ textAlign: 'right' }}>
        {children}
      </span>
    </div>
  )
}
