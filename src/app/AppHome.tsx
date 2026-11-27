import { useAuth } from '../lib/auth/AuthContext'
import { InstallPrompt } from '../pwa/InstallPrompt'

const VERIFICATION_TEXT = {
  unverified: 'Your account is not yet verified. ID verification is required before you can submit reports.',
  pending: 'Your ID is being reviewed by the municipality.',
  approved: 'Your account is verified.',
  rejected: 'Your ID verification was not approved. You may submit a new ID.',
} as const

export function AppHome() {
  const { profile } = useAuth()

  return (
    <section className="stack">
      <h1>Hello, {profile?.display_name}</h1>
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
