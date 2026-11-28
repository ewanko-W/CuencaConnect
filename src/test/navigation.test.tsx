import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authAs, makeProfile, renderWithAuth } from './renderWithAuth'

// Leaflet does not run in jsdom.
vi.mock('../components/map/BaseMap', () => ({
  BaseMap: ({ label }: { label: string }) => <div role="region" aria-label={label} />,
}))
vi.mock('../components/admin/ReportsMap', () => ({ ReportsMap: () => null }))

const resident = () => authAs('resident', { profile: makeProfile('resident', { verification_status: 'approved' }) })

/** Returns the accessible names of links marked as the current page. */
function currentLinks(nav: HTMLElement): string[] {
  return within(nav)
    .getAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'page')
    .map((link) => link.getAttribute('aria-label') ?? link.textContent ?? '')
}

describe('resident bottom navigation highlights exactly one current page', () => {
  it.each([
    ['/app', 'Home'],
    ['/app/report', 'Report'],
    ['/app/reports', 'My reports'],
    ['/app/reports/some-report-id', 'My reports'],
    ['/app/map', 'Map'],
    ['/app/alerts', 'Alerts'],
  ])('%s highlights %s', async (path, label) => {
    renderWithAuth(path, resident())
    const nav = await screen.findByRole('navigation', { name: 'Resident navigation' })
    expect(currentLinks(nav)).toEqual([label])
    const active = within(nav).getByRole('link', { current: 'page' })
    expect(active).toHaveClass('active')
  })

  it.each([
    ['/app/directory', 'Hotlines and offices'],
    ['/app/profile', 'Profile'],
  ])('%s highlights the %s top-bar link and no bottom tab', async (path, label) => {
    renderWithAuth(path, resident())
    const quickLinks = await screen.findByRole('navigation', { name: 'Quick links' })
    expect(currentLinks(quickLinks)).toEqual([label])
    expect(currentLinks(screen.getByRole('navigation', { name: 'Resident navigation' }))).toEqual([])
  })
})

describe('admin sidebar highlights the current page', () => {
  it.each([
    ['/admin/command', 'Command Center'],
    ['/admin/command/some-report-id', 'Command Center'],
    ['/admin/alerts', 'Alerts'],
    ['/admin/keywords', 'Keywords'],
    ['/admin/audit', 'Audit log'],
  ])('%s highlights %s', async (path, label) => {
    renderWithAuth(path, authAs('admin'))
    const nav = await screen.findByRole('navigation', { name: 'Admin navigation' })
    expect(currentLinks(nav)).toEqual([label])
  })
})

describe('office sidebar highlights the current page', () => {
  it('/office highlights Inbox', async () => {
    renderWithAuth('/office', authAs('office_staff'))
    const nav = await screen.findByRole('navigation', { name: 'Office navigation' })
    expect(currentLinks(nav)).toEqual(['Inbox'])
  })
})
