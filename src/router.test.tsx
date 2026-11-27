import { render, screen } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { routes } from './router'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

describe('route map (Phase 0 placeholders)', () => {
  it('redirects / to the resident app', async () => {
    const router = renderAt('/')
    expect(await screen.findByRole('heading', { name: 'Resident app' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/app')
  })

  it('renders the resident area at /app', async () => {
    renderAt('/app')
    expect(await screen.findByRole('navigation', { name: 'Resident navigation' })).toBeInTheDocument()
  })

  it('renders the admin command center at /admin', async () => {
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Command Center' })).toBeInTheDocument()
  })

  it('renders the office inbox at /office', async () => {
    renderAt('/office')
    expect(await screen.findByRole('heading', { name: 'Office inbox' })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})
