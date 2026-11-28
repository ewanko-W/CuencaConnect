import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth/AuthContext'

const MESSAGES = {
  unverified: 'ID verification is required before you can report incidents, view the incident map, or vote.',
  pending: 'Your ID is being reviewed. You can report incidents once it is approved.',
  rejected: 'Your ID verification was not approved. Please submit a new ID.',
} as const

/**
 * Shows children only to ID-verified residents. UX only: submit_report,
 * nearby_reports, and the report_votes RLS policies enforce the same rule.
 */
export function VerificationGate({ feature, children }: { feature: string; children: ReactNode }) {
  const { profile } = useAuth()
  const status = profile?.verification_status ?? 'unverified'
  if (status === 'approved') return <>{children}</>

  return (
    <section className="card gate" aria-labelledby="gate-title">
      <h2 id="gate-title">{feature} requires a verified account</h2>
      <p>{MESSAGES[status]}</p>
      <p className="muted">
        You can still read <Link to="/app/alerts">alerts</Link> and the <Link to="/app/directory">hotline directory</Link>.
      </p>
    </section>
  )
}
