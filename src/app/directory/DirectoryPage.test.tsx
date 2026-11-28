import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { authAs, renderWithAuth } from '../../test/renderWithAuth'

vi.mock('../../lib/directory/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/directory/api')>()
  return {
    ...actual,
    fetchOffices: vi.fn(async () => [
      { id: 2, code: 'BFP', name: 'Bureau of Fire Protection - Cuenca', hotline: '(043) 000-0002', contact_info: null },
      { id: 1, code: 'MDRRMO', name: 'Municipal Disaster Risk Reduction and Management Office', hotline: null, contact_info: 'Municipal Hall' },
    ]),
  }
})

describe('DirectoryPage', () => {
  it('is available to unverified residents and offers one-tap calling', async () => {
    renderWithAuth('/app/directory', authAs('resident'))
    expect(await screen.findByRole('link', { name: 'Call Bureau of Fire Protection - Cuenca' })).toHaveAttribute(
      'href',
      'tel:0430000002',
    )
    expect(screen.getByRole('link', { name: /national emergency hotline/i })).toHaveAttribute('href', 'tel:911')
    expect(screen.getByText('No hotline listed')).toBeInTheDocument()
  })
})
