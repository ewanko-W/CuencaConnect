import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { IncidentCard } from '../../app/map/NearbyMapPage'
import type { NearbyReport } from '../../lib/reports/types'
import { CommunityBadge } from './CommunityBadge'

vi.mock('../map/BaseMap', () => ({ BaseMap: () => null }))
vi.mock('../../lib/reports/api', () => ({ castVote: vi.fn(), withdrawVote: vi.fn(), fetchNearbyReports: vi.fn() }))

const base: NearbyReport = {
  id: 'r1',
  category: 'fire',
  status: 'submitted',
  approx_lat: 13.91,
  approx_lng: 121.05,
  distance_m: 120,
  created_at: new Date().toISOString(),
  confirm_count: 0,
  dispute_count: 4,
  my_vote: null,
  is_mine: false,
  is_critical: true,
  community_status: 'disputed',
}

describe('CommunityBadge', () => {
  it('labels confirmed and disputed reports and hides pending by default', () => {
    const { rerender, container } = render(<CommunityBadge status="confirmed" />)
    expect(screen.getByText('Community-confirmed')).toBeInTheDocument()
    rerender(<CommunityBadge status="disputed" />)
    expect(screen.getByText('Disputed')).toBeInTheDocument()
    rerender(<CommunityBadge status="pending" />)
    expect(container).toBeEmptyDOMElement()
    rerender(<CommunityBadge status="pending" showPending />)
    expect(screen.getByText('Awaiting confirmation')).toBeInTheDocument()
  })
})

describe('IncidentCard (nearby map)', () => {
  it('keeps a disputed critical report visible and explains why', () => {
    render(<IncidentCard report={base} onVote={vi.fn()} onClose={vi.fn()} />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
    expect(screen.getByText('Disputed')).toBeInTheDocument()
    expect(screen.getByRole('note')).toHaveTextContent(/stays visible because it may be an emergency/i)
  })

  it('shows no emergency note for routine reports', () => {
    render(
      <IncidentCard
        report={{ ...base, category: 'road', is_critical: false, community_status: 'confirmed', confirm_count: 3, dispute_count: 0 }}
        onVote={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(screen.queryByText('Critical')).not.toBeInTheDocument()
    expect(screen.getByText('Community-confirmed')).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })
})
