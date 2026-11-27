import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { FullPageStatus } from '../components/FullPageStatus'
import { useAuth } from '../lib/auth/AuthContext'
import { homePathForRole, isPathInRoleArea } from '../lib/auth/types'
import type { RedirectState } from './RequireRole'

/**
 * Wraps login and registration pages. A signed-in user is sent to the
 * deep link they originally requested if it belongs to their role's area,
 * otherwise to their role's home.
 */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.status === 'loading') {
    return <FullPageStatus>Loading…</FullPageStatus>
  }

  if (auth.status === 'signedIn' && auth.profile) {
    const from = (location.state as RedirectState | null)?.from
    const role = auth.profile.role
    const target = from && isPathInRoleArea(from.split('?')[0], role) ? from : homePathForRole(role)
    return <Navigate to={target} replace />
  }

  return <>{children}</>
}
