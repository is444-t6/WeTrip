import { Link } from '@tanstack/react-router'

// What a signed-out visitor sees on a page that needs a session.
export default function SignedOutCard({ title }) {
  return (
    <div className="center-page">
      <div className="card center-card" style={{ textAlign: 'center' }}>
        <h1>{title}</h1>
        <p className="muted">You're not signed in yet.</p>
        <Link to="/login" className="btn" style={{ width: '100%', marginTop: 8 }}>
          Continue to sign in
        </Link>
      </div>
    </div>
  )
}
