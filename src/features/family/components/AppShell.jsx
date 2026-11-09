import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="m5 12.5 4.4 4.4L19 7.3"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function Brand() {
  return (
    <Link to="/family" className="brand" aria-label="WeTrip home">
      <BrandMark />
      <span className="brand-word">wetrip</span>
    </Link>
  )
}

function InsuranceMenu({ secondaryNav }) {
  return (
    <div className="nav-insurance-menu">
      <Link
        to="/insurance"
        className="nav-link"
        activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
      >
        Insurance
      </Link>
      {secondaryNav && <div className="navbar-subnav">{secondaryNav}</div>}
    </div>
  )
}

export default function AppShell({ onSignOut, secondaryNav, children }) {
  // Each page mounts its own shell, so this focuses the new page's main
  // landmark after a route change (and after signing in or out).
  useEffect(() => {
    document.getElementById('wetrip-main')?.focus()
  }, [])

  return (
    <>
      <a className="skip-link" href="#wetrip-main">
        Skip to content
      </a>
      <header className="navbar">
        <div className="navbar-inner">
          <Brand />
          <nav className="nav-tabs" aria-label="WeTrip">
            <Link
              to="/family"
              className="nav-link"
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              Family
            </Link>
            <Link
              to="/fx"
              className="nav-link"
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              SmartFX
            </Link>
            <Link
              to="/budget"
              className="nav-link"
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              Budget
            </Link>
            <InsuranceMenu secondaryNav={secondaryNav} />
            <Link
              to="/pay"
              className="nav-link"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              Scan to Pay
            </Link>
            <Link
              to="/pay/history"
              className="nav-link"
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              My Payments
            </Link>
          </nav>
          {onSignOut && (
            <button className="ghost" onClick={onSignOut}>
              Sign out
            </button>
          )}
        </div>
      </header>
      <main className="page" id="wetrip-main" tabIndex={-1}>
        {children}
      </main>
    </>
  )
}
