import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'

// The WeTrip logo. Decorative beside the wordmark; give it an alt when it stands alone.
export function BrandMark({ alt = '', size, style }) {
  return (
    <img
      className="brand-mark"
      src="/wetrip_logo.svg"
      alt={alt}
      style={size ? { width: size, height: size, ...style } : style}
    />
  )
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="WeTrip">
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
              to="/"
              className="nav-link"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              Home
            </Link>
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
