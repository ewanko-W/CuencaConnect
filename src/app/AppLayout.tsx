import { Bell, ClipboardList, House, Map as MapIcon, Phone, CirclePlus, User } from 'lucide-react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAlerts } from '../lib/alerts/AlertsContext'
import { AlertsProvider } from '../lib/alerts/AlertsProvider'
import { useAuth } from '../lib/auth/AuthContext'
import { useOutbox } from '../lib/reports/OutboxContext'
import { OutboxProvider } from '../lib/reports/OutboxProvider'
import { OfflineBanner } from '../pwa/OfflineBanner'

/** Mobile-first resident shell: top bar plus bottom navigation. */
export function AppLayout() {
  const { session } = useAuth()
  return (
    <OutboxProvider userId={session?.user.id ?? 'anonymous'}>
      <AlertsProvider>
        <AppShell />
      </AlertsProvider>
    </OutboxProvider>
  )
}

function AppShell() {
  const { alerts } = useAlerts()
  const { drafts } = useOutbox()
  const urgent = alerts.filter((a) => a.level !== 'advisory').length

  return (
    <div className="layout layout--app">
      <header className="topbar">
        <Link to="/app" className="brand topbar__brand">
          CuencaConnect
        </Link>
        <nav className="topbar__actions" aria-label="Quick links">
          <NavLink to="/app/directory" className="topbar__icon" aria-label="Hotlines and offices" title="Hotlines and offices">
            <Phone size={22} aria-hidden="true" />
          </NavLink>
          <NavLink to="/app/profile" className="topbar__icon" aria-label="Profile" title="Profile">
            <User size={22} aria-hidden="true" />
          </NavLink>
        </nav>
      </header>
      <OfflineBanner context="resident" />
      <main className="content">
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Resident navigation">
        <NavLink to="/app" end>
          <House size={22} aria-hidden="true" />
          <span className="bottom-nav__label">Home</span>
        </NavLink>
        <NavLink to="/app/report">
          <CirclePlus size={22} aria-hidden="true" />
          <span className="bottom-nav__label">Report</span>
        </NavLink>
        <NavLink to="/app/reports">
          <ClipboardList size={22} aria-hidden="true" />
          <span className="bottom-nav__label">My reports</span>
          {drafts.length > 0 && (
            <span className="nav-badge" aria-label={`${drafts.length} unsent`}>
              {drafts.length}
            </span>
          )}
        </NavLink>
        <NavLink to="/app/map">
          <MapIcon size={22} aria-hidden="true" />
          <span className="bottom-nav__label">Map</span>
        </NavLink>
        <NavLink to="/app/alerts">
          <Bell size={22} aria-hidden="true" />
          <span className="bottom-nav__label">Alerts</span>
          {urgent > 0 && (
            <span className="nav-badge nav-badge--urgent" aria-label={`${urgent} urgent`}>
              {urgent}
            </span>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
