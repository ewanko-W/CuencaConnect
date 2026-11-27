import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { signInWithEmail } from '../../lib/auth/api'
import { useAuth } from '../../lib/auth/AuthContext'
import { OfflineBanner } from '../../pwa/OfflineBanner'

export type LoginArea = 'app' | 'admin' | 'office'

const TITLES: Record<LoginArea, string> = {
  app: 'Resident sign in',
  admin: 'Admin sign in',
  office: 'Office staff sign in',
}

/**
 * Email and password sign-in, shared by the three areas. After success the
 * RedirectIfSignedIn wrapper sends the user to their own role's area, so a
 * resident who signs in on /admin/login lands on /app.
 */
export function LoginPage({ area }: { area: LoginArea }) {
  const { configured } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithEmail(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className={`auth-page auth-page--${area}`}>
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <p className="brand brand--dark">CuencaConnect</p>
        <h1>{TITLES[area]}</h1>
        <OfflineBanner context="auth" />

        {!configured && (
          <p className="alert alert--warning">
            Supabase is not configured. Copy .env.example to .env.local and restart the dev server.
          </p>
        )}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>

        {area === 'app' && (
          <p className="muted">
            New to CuencaConnect? <Link to="/app/register">Create a resident account</Link>
          </p>
        )}
        {area !== 'app' && (
          <p className="muted">Staff accounts are created by the municipal administrator.</p>
        )}
      </form>
    </main>
  )
}
