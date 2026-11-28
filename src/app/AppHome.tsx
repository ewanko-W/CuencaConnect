import { CirclePlus, ClipboardList, Map as MapIcon, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAlerts } from '../lib/alerts/AlertsContext'
import { useAuth } from '../lib/auth/AuthContext'
import { useOutbox } from '../lib/reports/OutboxContext'
import { InstallPrompt } from '../pwa/InstallPrompt'
import { AlertCard } from './alerts/AlertsPage'

const VERIFICATION_TEXT = {
  unverified: 'Your account is not yet verified. ID verification is required before you can submit reports or vote.',
  pending: 'Your ID is being reviewed by the municipality.',
  approved: 'Your account is verified. You can report incidents and confirm or dispute nearby reports.',
  rejected: 'Your ID verification was not approved. You may submit a new ID.',
} as const

export function AppHome() {
  const { profile } = useAuth()
  const { alerts } = useAlerts()
  const { drafts } = useOutbox()
  const topAlert = alerts[0]

  return (
    <section className="stack">
      <h1>Hello, {profile?.display_name}</h1>

      {topAlert && (
        <>
          <AlertCard alert={topAlert} />
          {alerts.length > 1 && <Link to="/app/alerts">See all {alerts.length} alerts</Link>}
        </>
      )}

      {drafts.length > 0 && (
        <p className="alert alert--warning">
          {drafts.length} report(s) waiting to send. <Link to="/app/reports">Review</Link>
        </p>
      )}

      <div className="quick-actions">
        <Link to="/app/report" className="quick-action quick-action--primary">
          <CirclePlus size={28} aria-hidden="true" /> Report an incident
        </Link>
        <Link to="/app/map" className="quick-action">
          <MapIcon size={28} aria-hidden="true" /> Nearby incidents
        </Link>
        <Link to="/app/reports" className="quick-action">
          <ClipboardList size={28} aria-hidden="true" /> My reports
        </Link>
        <Link to="/app/directory" className="quick-action">
          <Phone size={28} aria-hidden="true" /> Hotlines
        </Link>
      </div>

      {profile && (
        <div className={`card status-card status-card--${profile.verification_status}`}>
          <h2>Account status</h2>
          <p>{VERIFICATION_TEXT[profile.verification_status]}</p>
        </div>
      )}
      <InstallPrompt />
    </section>
  )
}
