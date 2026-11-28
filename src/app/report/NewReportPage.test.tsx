import 'fake-indexeddb/auto'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteDraft, listDrafts, resetOutboxConnection } from '../../lib/reports/outbox'
import { authAs, makeProfile, renderWithAuth } from '../../test/renderWithAuth'

// Leaflet does not run in jsdom; replace the map with a button that sets a pin.
vi.mock('../../components/map/LocationPicker', () => ({
  LocationPicker: ({ onChange }: { onChange: (p: { lat: number; lng: number }) => void }) => (
    <button type="button" onClick={() => onChange({ lat: 13.9101, lng: 121.0502 })}>
      Place test pin
    </button>
  ),
}))

const verifiedResident = () =>
  authAs('resident', { profile: makeProfile('resident', { id: 'user-resident', verification_status: 'approved' }) })

async function fillReport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Place test pin' }))
  await user.click(screen.getByRole('radio', { name: /flood/i }))
  await user.type(screen.getByRole('textbox', { name: 'Description' }), 'Knee-deep flood water near the chapel.')
}

describe('NewReportPage', () => {
  beforeEach(async () => {
    resetOutboxConnection()
    for (const d of await listDrafts('user-resident')) await deleteDraft(d.clientUuid)
  })
  afterEach(() => vi.restoreAllMocks())

  it('asks unverified residents to verify first (no form)', async () => {
    renderWithAuth('/app/report', authAs('resident'))
    expect(await screen.findByRole('heading', { name: /reporting requires a verified account/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Send report' })).not.toBeInTheDocument()
  })

  it('shows validation messages before sending', async () => {
    const user = userEvent.setup()
    renderWithAuth('/app/report', verifiedResident())
    await user.click(await screen.findByRole('button', { name: 'Send report' }))
    expect(screen.getByText(/choose what kind of incident/i)).toBeInTheDocument()
    expect(screen.getByText(/set the location/i)).toBeInTheDocument()
  })

  it('keeps the draft on the device when offline and lets the user retry from My reports', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const user = userEvent.setup()
    renderWithAuth('/app/report', verifiedResident())

    await fillReport(user)
    await user.click(screen.getByRole('button', { name: 'Send report' }))

    expect(await screen.findByRole('heading', { name: 'Saved on this device' })).toBeInTheDocument()
    const drafts = await listDrafts('user-resident')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({
      category: 'flood',
      description: 'Knee-deep flood water near the chapel.',
      lat: 13.9101,
      lng: 121.0502,
      locationSource: 'manual',
    })

    await user.click(screen.getByRole('link', { name: 'Go to My reports' }))
    const outbox = await screen.findByRole('region', { name: /waiting to send \(1\)/i })
    await user.click(within(outbox).getByRole('button', { name: 'Retry' }))
    // Still offline: the draft stays and the reason is shown.
    expect(await within(outbox).findByText(/you are offline/i)).toBeInTheDocument()
    await waitFor(async () => expect(await listDrafts('user-resident')).toHaveLength(1))
  })
})

function mockGeolocation(accuracy: number) {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (success: PositionCallback) =>
        success({ coords: { latitude: 13.9094, longitude: 121.0503, accuracy } } as GeolocationPosition),
    },
  })
}

describe('NewReportPage location accuracy', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'geolocation')
  })

  it('uses a precise GPS fix as the pin', async () => {
    mockGeolocation(12)
    renderWithAuth('/app/report', verifiedResident())
    expect(await screen.findByText(/GPS location \(accuracy about 12 m\)/)).toBeInTheDocument()
  })

  it('does not place the pin from an approximate fix (e.g., a desktop with ~50 km accuracy)', async () => {
    mockGeolocation(50000)
    const user = userEvent.setup()
    renderWithAuth('/app/report', verifiedResident())
    expect(await screen.findByText(/only an approximate location \(about 50 km\)/)).toBeInTheDocument()
    expect(screen.queryByText(/GPS location/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect(screen.getByText(/set the location of the incident/i)).toBeInTheDocument()
  })
})
