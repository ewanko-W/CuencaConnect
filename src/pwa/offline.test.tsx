import { act, render, screen, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '../lib/auth/AuthContext'
import { AuthProvider } from '../lib/auth/AuthProvider'
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from '../lib/auth/profileCache'
import type { Profile } from '../lib/auth/types'
import { OFFLINE_LOAD_MESSAGE } from '../lib/network'
import { useAsyncData } from '../lib/useAsyncData'
import { OfflineBanner } from './OfflineBanner'

let online = true
function setOnline(value: boolean) {
  online = value
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

beforeEach(() => {
  online = true
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online)
})
afterEach(() => {
  vi.restoreAllMocks()
  clearCachedProfile()
})

describe('OfflineBanner', () => {
  it('appears when the connection drops and disappears when it returns', () => {
    render(<OfflineBanner context="resident" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()

    act(() => setOnline(false))
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent('You are offline.')
    expect(banner).toHaveTextContent(/saved on this phone and sent automatically/i)
    expect(banner).toHaveTextContent(/911/)

    act(() => setOnline(true))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('tells staff that changes cannot be saved and visitors that they cannot sign in', () => {
    online = false
    const { rerender } = render(<OfflineBanner context="staff" />)
    expect(screen.getByRole('status')).toHaveTextContent(/changes cannot be saved/i)
    rerender(<OfflineBanner context="auth" />)
    expect(screen.getByRole('status')).toHaveTextContent(/connect to the internet to sign in/i)
  })
})

function Loader({ load }: { load: () => Promise<string> }) {
  const { data, error } = useAsyncData(load, [])
  return <p>{error ?? data ?? 'loading'}</p>
}

describe('useAsyncData offline behaviour', () => {
  it('shows a clear offline message and loads again when the connection returns', async () => {
    online = false
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce('Loaded alerts')
    render(<Loader load={load} />)
    expect(await screen.findByText(OFFLINE_LOAD_MESSAGE)).toBeInTheDocument()

    act(() => setOnline(true))
    expect(await screen.findByText('Loaded alerts')).toBeInTheDocument()
  })
})

const profile: Profile = {
  id: 'user-1',
  role: 'resident',
  display_name: 'Maria Santos',
  barangay_id: 6,
  office_id: null,
  verification_status: 'approved',
}

function fakeClient(profileResult: () => Promise<{ data: Profile | null; error: { message: string } | null }>) {
  const session = { user: { id: 'user-1' } }
  return {
    auth: {
      getSession: vi.fn(async () => ({ data: { session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => ({ select: () => ({ eq: () => ({ single: profileResult }) }) })),
  } as unknown as SupabaseClient
}

function WhoAmI() {
  const { status, profile: p, profileError } = useAuth()
  return <p>{status === 'signedIn' ? (p ? `${p.display_name} (${p.role})` : `error: ${profileError}`) : status}</p>
}

describe('starting the installed app offline', () => {
  it('uses the profile saved on this device when the network is unavailable', async () => {
    saveCachedProfile(profile)
    online = false
    const client = fakeClient(async () => Promise.reject(new TypeError('Failed to fetch')))
    render(
      <AuthProvider client={client}>
        <WhoAmI />
      </AuthProvider>,
    )
    expect(await screen.findByText('Maria Santos (resident)')).toBeInTheDocument()
  })

  it('does not use the cache for a different user or for non-network errors', async () => {
    saveCachedProfile({ ...profile, id: 'someone-else' })
    const client = fakeClient(async () => Promise.reject(new Error('JWT expired')))
    render(
      <AuthProvider client={client}>
        <WhoAmI />
      </AuthProvider>,
    )
    expect(await screen.findByText('error: JWT expired')).toBeInTheDocument()
  })

  it('stores only UI fields and clears them on sign-out', async () => {
    const client = fakeClient(async () => ({ data: profile, error: null }))
    function SignOutButton() {
      const { signOut } = useAuth()
      return (
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      )
    }
    render(
      <AuthProvider client={client}>
        <WhoAmI />
        <SignOutButton />
      </AuthProvider>,
    )
    await screen.findByText('Maria Santos (resident)')
    expect(Object.keys(JSON.parse(localStorage.getItem('cc.profile.v1') ?? '{}')).sort()).toEqual(
      ['barangay_id', 'display_name', 'id', 'office_id', 'role', 'verification_status'],
    )
    await act(async () => screen.getByRole('button', { name: 'Sign out' }).click())
    await waitFor(() => expect(loadCachedProfile('user-1')).toBeNull())
  })
})
