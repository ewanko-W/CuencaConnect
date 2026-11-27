import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authAs, renderWithAuth } from '../test/renderWithAuth'

// Pages call the API on mount (e.g., barangay list); keep tests offline.
vi.mock('../lib/auth/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/auth/api')>()
  return { ...actual, fetchBarangays: vi.fn(async () => []), signInWithEmail: vi.fn() }
})

async function expectPath(router: { state: { location: { pathname: string } } }, path: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(path))
}

describe('RequireRole: signed-out users', () => {
  it.each([
    ['/app', '/app/login'],
    ['/app/profile', '/app/login'],
    ['/admin', '/admin/login'],
    ['/office', '/office/login'],
  ])('redirects %s to %s', async (from, to) => {
    const { router } = renderWithAuth(from, authAs(null))
    await expectPath(router, to)
  })

  it('remembers the requested deep link for after sign-in', async () => {
    const { router } = renderWithAuth('/app/profile', authAs(null))
    await expectPath(router, '/app/login')
    expect(router.state.location.state).toEqual({ from: '/app/profile' })
  })
})

describe('RequireRole: role separation', () => {
  it('redirects a resident away from /admin to /app', async () => {
    const { router } = renderWithAuth('/admin', authAs('resident'))
    await expectPath(router, '/app')
    expect(screen.queryByRole('navigation', { name: 'Admin navigation' })).not.toBeInTheDocument()
    expect(await screen.findByRole('navigation', { name: 'Resident navigation' })).toBeInTheDocument()
  })

  it('redirects a resident away from /office to /app', async () => {
    const { router } = renderWithAuth('/office', authAs('resident'))
    await expectPath(router, '/app')
  })

  it('redirects office staff away from /admin to /office', async () => {
    const { router } = renderWithAuth('/admin', authAs('office_staff'))
    await expectPath(router, '/office')
  })

  it('redirects an admin from the resident app to /admin', async () => {
    const { router } = renderWithAuth('/app', authAs('admin'))
    await expectPath(router, '/admin')
  })

  it('lets a resident into /app with the bottom navigation', async () => {
    renderWithAuth('/app', authAs('resident'))
    expect(await screen.findByRole('navigation', { name: 'Resident navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /hello, test resident/i })).toBeInTheDocument()
  })

  it('lets an admin into /admin with the sidebar', async () => {
    renderWithAuth('/admin', authAs('admin'))
    expect(await screen.findByRole('navigation', { name: 'Admin navigation' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Command Center' })).toBeInTheDocument()
  })

  it('lets office staff into /office', async () => {
    renderWithAuth('/office', authAs('office_staff'))
    expect(await screen.findByRole('heading', { name: 'Office inbox' })).toBeInTheDocument()
  })
})

describe('RequireRole: loading and errors', () => {
  it('shows a loading status instead of redirecting while auth is loading', async () => {
    const { router } = renderWithAuth('/admin', authAs(null, { status: 'loading' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Loading')
    expect(router.state.location.pathname).toBe('/admin')
  })

  it('offers sign-out when the profile cannot be loaded', async () => {
    const auth = authAs('resident', { profile: null, profileError: 'network error' })
    renderWithAuth('/app', auth)
    expect(await screen.findByText(/could not load your profile: network error/i)).toBeInTheDocument()
    screen.getByRole('button', { name: 'Sign out' }).click()
    expect(auth.signOut).toHaveBeenCalled()
  })
})

describe('RedirectIfSignedIn: login and registration pages', () => {
  it('shows the login form to signed-out users', async () => {
    renderWithAuth('/app/login', authAs(null))
    expect(await screen.findByRole('heading', { name: 'Resident sign in' })).toBeInTheDocument()
  })

  it('sends a signed-in resident from /app/login to /app', async () => {
    const { router } = renderWithAuth('/app/login', authAs('resident'))
    await expectPath(router, '/app')
  })

  it('sends a resident who signs in on /admin/login to /app', async () => {
    const { router } = renderWithAuth('/admin/login', authAs('resident'))
    await expectPath(router, '/app')
  })

  it('returns a signed-in user to the remembered deep link in their own area', async () => {
    const { router } = renderWithAuth('/app/login', authAs('resident'), { from: '/app/profile' })
    await expectPath(router, '/app/profile')
  })

  it('ignores a remembered deep link from another role area', async () => {
    const { router } = renderWithAuth('/admin/login', authAs('resident'), { from: '/admin' })
    await expectPath(router, '/app')
  })

  it('sends a signed-in user away from the registration page', async () => {
    const { router } = renderWithAuth('/app/register', authAs('resident'))
    await expectPath(router, '/app')
  })
})

describe('other routes', () => {
  it('redirects / to /app (and then to login when signed out)', async () => {
    const { router } = renderWithAuth('/', authAs(null))
    await expectPath(router, '/app/login')
  })

  it('shows a not-found page for unknown routes', async () => {
    renderWithAuth('/does-not-exist', authAs(null))
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
