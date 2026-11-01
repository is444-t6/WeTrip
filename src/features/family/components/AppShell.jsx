import { Link } from '@tanstack/react-router'

export default function AppShell({ onSignOut, children }) {
  return (
    <>
      <div className="navbar">
        <div className="navbar-inner">
          <Link to="/family" className="brand" style={{ textDecoration: 'none' }}>
            <span className="brand-mark">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M3 12c0-4.97 4.03-9 9-9s9 4.03 9 9-4.03 9-9 9-9-4.03-9-9Z"
                  stroke="#fff"
                  strokeWidth="1.6"
                />
                <path d="M7.5 12.5 10.5 15.5 16.5 9" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            WeTrip
          </Link>
          <div className="row">
            <Link to="/family" className="nav-link">Family</Link>
            <Link to="/fx" className="nav-link">SmartFX</Link>
            <Link to="/insurance" className="nav-link">Insurance</Link>
            <Link to="/insurance/policies" className="nav-link">My Insurance</Link>
            {onSignOut && (
              <button className="ghost" onClick={onSignOut}>Sign out</button>
            )}
          </div>
        </div>
      </div>
      <div className="page">{children}</div>
    </>
  )
}
