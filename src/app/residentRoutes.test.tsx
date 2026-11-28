import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authAs, makeProfile, renderWithAuth } from '../test/renderWithAuth'

vi.mock('../components/map/BaseMap', () => ({
  BaseMap: ({ label }: { label: string }) => <div role="region" aria-label={label} />,
}))
vi.mock('../lib/reports/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/reports/api')>()
  return { ...actual, fetchNearbyReports: vi.fn(async () => []), fetchMyReports: vi.fn(async () => []) }
})

describe('resident area: verification gating (CLAUDE.md)', () => {
  it.each([
    ['/app/report', /reporting requires a verified account/i],
    ['/app/map', /the incident map requires a verified account/i],
    ['/app/reports', /reporting requires a verified account/i],
  ])('unverified residents see a verification notice on %s', async (path, heading) => {
    renderWithAuth(path, authAs('resident'))
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument()
  })

  it('unverified residents can still open alerts', async () => {
    renderWithAuth('/app/alerts', authAs('resident'))
    expect(await screen.findByRole('heading', { name: 'Alerts' })).toBeInTheDocument()
  })

  it('verified residents see the nearby map', async () => {
    renderWithAuth('/app/map', authAs('resident', { profile: makeProfile('resident', { verification_status: 'approved' }) }))
    expect(await screen.findByRole('region', { name: 'Map of nearby incidents' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'No active incidents nearby' })).toBeInTheDocument()
  })

  it('the bottom navigation links to every resident feature', async () => {
    renderWithAuth('/app', authAs('resident'))
    const nav = await screen.findByRole('navigation', { name: 'Resident navigation' })
    const links = within(nav).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])
    expect(links).toEqual([
      ['Home', '/app'],
      ['Report', '/app/report'],
      ['My reports', '/app/reports'],
      ['Map', '/app/map'],
      ['Alerts', '/app/alerts'],
    ])
    expect(screen.getByRole('link', { name: 'Hotlines and offices' })).toHaveAttribute('href', '/app/directory')
  })
})
