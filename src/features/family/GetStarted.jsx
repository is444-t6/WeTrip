import LinkChildForm from './components/LinkChildForm'

// Shown when GetMyFamilyRole returns "None" — this customer has no
// children linked (not a Parent) and nobody has linked them as a child
// either (not Pending/Child). The system can't tell which role they want,
// so offer both paths: start as a parent right here, or wait to be invited.
export default function GetStarted() {
  return (
    <div>
      <h2>Get started with WeTrip Family</h2>
      <p className="muted">Link a child to start managing their spending, or wait for a parent to invite you.</p>

      <div className="section-title">Link a child</div>
      <LinkChildForm onLinked={() => window.location.reload()} />

      <div className="card" style={{ marginTop: 4 }}>
        <p className="muted" style={{ margin: 0 }}>
          Expecting an invite instead? Ask your parent to look up your phone number from their WeTrip Family screen —
          it'll show up here as soon as they do.
        </p>
      </div>
    </div>
  )
}
