import { describe, expect, it } from 'vitest'
import { buildTimeline } from './timeline'
import type { StatusEvent } from './types'

const ev = (status: StatusEvent['status'], at: string, note: string | null = null): StatusEvent => ({
  status,
  note,
  created_at: at,
})

describe('buildTimeline', () => {
  it('shows the full path with done, current, and upcoming steps', () => {
    const steps = buildTimeline('routed', [ev('submitted', '2026-11-27T01:00:00Z'), ev('routed', '2026-11-27T02:00:00Z', 'Sent to MEO')])
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['submitted', 'done'],
      ['routed', 'current'],
      ['acknowledged', 'upcoming'],
      ['in_progress', 'upcoming'],
      ['resolved', 'upcoming'],
    ])
    expect(steps[1].event?.note).toBe('Sent to MEO')
    expect(steps[2].event).toBeNull()
  })

  it('marks every step done when the report is resolved', () => {
    const steps = buildTimeline('resolved', [ev('submitted', '2026-11-27T01:00:00Z'), ev('resolved', '2026-11-27T09:00:00Z')])
    expect(steps.at(-1)).toMatchObject({ status: 'resolved', state: 'current' })
    expect(steps.slice(0, -1).every((s) => s.state === 'done')).toBe(true)
  })

  it('lists the actual events for rejected or duplicate reports', () => {
    const steps = buildTimeline('rejected', [ev('submitted', '2026-11-27T01:00:00Z'), ev('rejected', '2026-11-27T02:00:00Z', 'Not in Cuenca')])
    expect(steps.map((s) => [s.status, s.state])).toEqual([
      ['submitted', 'done'],
      ['rejected', 'current'],
    ])
  })
})
