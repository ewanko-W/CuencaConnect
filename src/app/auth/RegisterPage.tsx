import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { PrivacyNotice } from '../../components/PrivacyNotice'
import { fetchBarangays, signUpResident } from '../../lib/auth/api'
import type { Barangay } from '../../lib/auth/types'
import {
  PASSWORD_MIN_LENGTH,
  hasErrors,
  validateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '../../lib/auth/validation'

const EMPTY: RegistrationInput = {
  displayName: '',
  barangayId: '',
  email: '',
  password: '',
  confirmPassword: '',
  consent: false,
}

export function RegisterPage() {
  const [values, setValues] = useState<RegistrationInput>(EMPTY)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [barangays, setBarangays] = useState<Barangay[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  useEffect(() => {
    let active = true
    fetchBarangays()
      .then((list) => active && setBarangays(list))
      .catch((err: unknown) => active && setLoadError(err instanceof Error ? err.message : 'Could not load barangays.'))
    return () => {
      active = false
    }
  }, [])

  function update<K extends keyof RegistrationInput>(key: K, value: RegistrationInput[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(null)
    const found = validateRegistration(values)
    setErrors(found)
    if (hasErrors(found)) return

    setSubmitting(true)
    try {
      const result = await signUpResident({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        barangayId: Number(values.barangayId),
      })
      // When email confirmation is off, the session arrives through the
      // AuthProvider and RedirectIfSignedIn navigates to /app.
      if (result.needsEmailConfirmation) setCheckEmail(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (checkEmail) {
    return (
      <main className="auth-page">
        <section className="card">
          <h1>Check your email</h1>
          <p>We sent a confirmation link to {values.email.trim()}. Open it, then sign in.</p>
          <Link to="/app/login">Go to sign in</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <p className="brand brand--dark">CuencaConnect</p>
        <h1>Create a resident account</h1>

        <label className="field">
          <span>Display name</span>
          <input
            autoComplete="nickname"
            value={values.displayName}
            onChange={(e) => update('displayName', e.target.value)}
            aria-invalid={Boolean(errors.displayName)}
            aria-describedby={errors.displayName ? 'err-displayName' : undefined}
          />
          {errors.displayName && <small id="err-displayName" className="field-error">{errors.displayName}</small>}
        </label>

        <label className="field">
          <span>Barangay</span>
          <select
            value={values.barangayId}
            onChange={(e) => update('barangayId', e.target.value)}
            aria-invalid={Boolean(errors.barangayId)}
            aria-describedby={errors.barangayId ? 'err-barangayId' : undefined}
          >
            <option value="">Select your barangay</option>
            {barangays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {errors.barangayId && <small id="err-barangayId" className="field-error">{errors.barangayId}</small>}
          {loadError && <small className="field-error">{loadError}</small>}
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => update('email', e.target.value)}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'err-email' : undefined}
          />
          {errors.email && <small id="err-email" className="field-error">{errors.email}</small>}
        </label>

        <label className="field">
          <span>Password (at least {PASSWORD_MIN_LENGTH} characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => update('password', e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'err-password' : undefined}
          />
          {errors.password && <small id="err-password" className="field-error">{errors.password}</small>}
        </label>

        <label className="field">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'err-confirmPassword' : undefined}
          />
          {errors.confirmPassword && (
            <small id="err-confirmPassword" className="field-error">{errors.confirmPassword}</small>
          )}
        </label>

        <PrivacyNotice />

        <label className="checkbox">
          <input
            type="checkbox"
            checked={values.consent}
            onChange={(e) => update('consent', e.target.checked)}
            aria-invalid={Boolean(errors.consent)}
            aria-describedby={errors.consent ? 'err-consent' : undefined}
          />
          <span>I have read and agree to the privacy notice.</span>
        </label>
        {errors.consent && <small id="err-consent" className="field-error">{errors.consent}</small>}

        {submitError && (
          <p className="alert alert--error" role="alert">
            {submitError}
          </p>
        )}

        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="muted">
          Already registered? <Link to="/app/login">Sign in</Link>
        </p>
      </form>
    </main>
  )
}
