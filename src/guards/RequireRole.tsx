import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FullPageStatus } from '../components/FullPageStatus'
import { useAuth } from '../lib/auth/AuthContext'
import { homePathForRole, type Role } from '../lib/auth/types'

export interface RedirectState {
  from?: string
}

/**
 * Route guard for an area (/app, /admin, /office).
 * - Signed out: go to the area's login page, remembering the requested path.
 * - Wrong role: go to the home of the user's own role (e.g., a resident
 *   opening /admin is sent to /app).
 *
 * This is a UX convenience only. Data access is enforced by Row Level
 * Security in the database, so bypassing this guard exposes no data.
 */
export function RequireRole({ allow, loginPath }: { allow: Role[]; loginPath: string }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return <FullPageStatus>Loading…</FullPageStatus>
  }

  if (auth.status === 'signedOut') {
    const state: RedirectState = { from: location.pathname + location.search }
    return <Navigate to={loginPath} replace state={state} />
  }

  if (!auth.profile) {
    return (
      <FullPageStatus>
        <p>We could not load your profile{auth.profileError ? `: ${auth.profileError}` : '.'}</p>
        <button type="button" className="button" onClick={() => void auth.signOut()}>
          Sign out
        </button>
      </FullPageStatus>
    )
  }

  if (!allow.includes(auth.profile.role)) {
    return <Navigate to={homePathForRole(auth.profile.role)} replace />
  }

  return <Outlet />
}
