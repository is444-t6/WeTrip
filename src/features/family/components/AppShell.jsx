import { Link, useLocation } from 'react-router-dom'

const NAV_LINKS = [
  { to: '/accounts', label: 'Accounts' },
  { to: '/family', label: 'Family' },
]

export default function AppShell({ onSignOut, children }) {
  const location = useLocation()

  return (
    <>
      <div className="navbar">
        <div className="navbar-inner">
          <Link to="/home" className="brand">
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
          {onSignOut && (
            <div className="row" style={{ gap: 18 }}>
              <nav className="row" style={{ gap: 14 }}>
                {NAV_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="nav-link"
                    data-active={location.pathname.startsWith(link.to)}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <button className="ghost" onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
      <div className="page">{children}</div>
    </>
  )
}
