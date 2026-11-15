import { useEffect } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { FamilyIcon, HomeIcon, PlaneIcon, ScanIcon } from '../features/home/components/Icons'

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
  // Trips covers the trip list, one trip's hub and its budget, so it stays lit on all of them.
  const onTrips = useRouterState({
    select: (s) => /^\/(fx|trips|budget)(\/|$)/.test(s.location.pathname),
  })

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
              <HomeIcon />
              Home
            </Link>
            <Link
              to="/fx"
              className={onTrips ? 'nav-link active' : 'nav-link'}
              aria-current={onTrips ? 'page' : undefined}
            >
              <PlaneIcon />
              Trips
            </Link>
            <Link
              to="/family"
              className="nav-link"
              activeProps={{ className: 'nav-link active', 'aria-current': 'page' }}
            >
              <FamilyIcon />
              Family
            </Link>
            {/* Insurance is reached from a trip or Home; its tab only appears on its own screens. */}
            {secondaryNav && <InsuranceMenu secondaryNav={secondaryNav} />}
            <Link
              to="/pay"
              className="nav-link nav-pay"
              activeProps={{ className: 'nav-link nav-pay active', 'aria-current': 'page' }}
            >
              <ScanIcon />
              Pay
            </Link>
          </nav>
          {/* On a phone the rail is a bottom bar, so the insurance tabs get their own header row. */}
          {secondaryNav && <div className="navbar-subnav-phone">{secondaryNav}</div>}
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
