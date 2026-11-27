import { render } from '@testing-library/react'
import type { Session } from '@supabase/supabase-js'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthContext, type AuthState } from '../lib/auth/AuthContext'
import type { Profile, Role } from '../lib/auth/types'
import { routes } from '../router'

export function makeProfile(role: Role, overrides: Partial<Profile> = {}): Profile {
  return {
    id: `user-${role}`,
    role,
    display_name: `Test ${role}`,
    barangay_id: role === 'resident' ? 6 : null,
    office_id: role === 'office_staff' ? 2 : null,
    verification_status: 'unverified',
    ...overrides,
  }
}

export function authAs(role: Role | null, overrides: Partial<AuthState> = {}): AuthState {
  const profile = role ? makeProfile(role) : null
  return {
    status: role ? 'signedIn' : 'signedOut',
    session: role ? ({ user: { id: profile!.id, email: `${role}@example.test` } } as unknown as Session) : null,
    profile,
    profileError: null,
    configured: true,
    signOut: vi.fn(async () => {}),
    refreshProfile: vi.fn(),
    ...overrides,
  }
}

/** Renders the real route table at `path` with a fixed auth state. */
export function renderWithAuth(path: string, auth: AuthState, state?: unknown) {
  const router = createMemoryRouter(routes, { initialEntries: [{ pathname: path, state }] })
  const utils = render(
    <AuthContext.Provider value={auth}>
      <RouterProvider router={router} />
    </AuthContext.Provider>,
  )
  return { router, ...utils }
}
