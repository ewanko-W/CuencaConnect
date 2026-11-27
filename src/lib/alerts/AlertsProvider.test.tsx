import { act, render, screen } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AlertsPage } from '../../app/alerts/AlertsPage'
import { AlertsProvider } from './AlertsProvider'
import type { Alert } from './types'

const advisory: Alert = {
  id: 'a1',
  title: 'Heavy rainfall advisory',
  body: 'Avoid low-lying roads.',
  level: 'advisory',
  scope: 'municipality',
  starts_at: '2026-11-27T01:00:00Z',
  expires_at: null,
}
const emergency: Alert = {
  id: 'a2',
  title: 'Evacuate the creek area',
  body: 'Proceed to the barangay hall.',
  level: 'emergency',
  scope: 'barangay',
  starts_at: '2026-11-27T02:00:00Z',
  expires_at: null,
}

/** Fake Supabase client: a queue of select() results and a capturable Realtime channel. */
function fakeClient(results: Alert[][]) {
  let onChange: (() => void) | null = null
  let onStatus: ((status: string) => void) | null = null
  const select = vi.fn(async () => ({ data: results.shift() ?? [], error: null }))
  const channel = {
    on: vi.fn((_type: string, _filter: unknown, cb: () => void) => {
      onChange = cb
      return channel
    }),
    subscribe: vi.fn((cb: (status: string) => void) => {
      onStatus = cb
      return channel
    }),
  }
  const client = {
    from: vi.fn(() => ({ select })),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(async () => 'ok'),
  } as unknown as SupabaseClient
  return {
    client,
    channel,
    select,
    emitChange: () => onChange?.(),
    emitStatus: (s: string) => onStatus?.(s),
  }
}

describe('AlertsProvider (Realtime)', () => {
  it('subscribes to alert changes and reloads the feed when one arrives', async () => {
    const fake = fakeClient([[advisory], [advisory, emergency]])
    render(
      <MemoryRouter>
        <AlertsProvider client={fake.client}>
          <AlertsPage />
        </AlertsProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: 'Heavy rainfall advisory' })).toBeInTheDocument()
    expect(fake.channel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'alerts' },
      expect.any(Function),
    )

    act(() => fake.emitStatus('SUBSCRIBED'))
    expect(screen.getByText('● Live')).toBeInTheDocument()

    // An admin publishes an emergency alert.
    await act(async () => fake.emitChange())
    const headings = await screen.findAllByRole('heading', { level: 2 })
    expect(headings.map((h) => h.textContent)).toEqual(['Evacuate the creek area', 'Heavy rainfall advisory'])
    expect(fake.select).toHaveBeenCalledTimes(2)
  })

  it('removes the Realtime channel when unmounted', async () => {
    const fake = fakeClient([[]])
    const { unmount } = render(
      <AlertsProvider client={fake.client}>
        <span>child</span>
      </AlertsProvider>,
    )
    await screen.findByText('child')
    unmount()
    expect(fake.client.removeChannel).toHaveBeenCalledWith(fake.channel)
  })
})
