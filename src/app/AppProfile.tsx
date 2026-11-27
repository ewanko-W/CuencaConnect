import { useAuth } from '../lib/auth/AuthContext'

export function AppProfile() {
  const { profile, session, signOut } = useAuth()

  return (
    <section className="stack">
      <h1>Profile</h1>
      <dl className="card details">
        <dt>Display name</dt>
        <dd>{profile?.display_name}</dd>
        <dt>Email</dt>
        <dd>{session?.user.email}</dd>
        <dt>Verification</dt>
        <dd>{profile?.verification_status}</dd>
      </dl>
      <button type="button" className="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </section>
  )
}
