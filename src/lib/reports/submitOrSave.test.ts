import { describe, expect, it, vi } from 'vitest'
import { submitOrSave, type SubmitDeps } from './submitOrSave'
import type { ReportDraft } from './types'

const draft: ReportDraft = {
  clientUuid: '11111111-1111-4111-8111-111111111111',
  userId: 'user-1',
  category: 'flood',
  description: 'Flooded street near the plaza.',
  lat: 13.91,
  lng: 121.05,
  accuracy: 12,
  locationSource: 'gps',
  photos: [],
  createdAt: '2026-11-27T00:00:00.000Z',
  attempts: 0,
  lastError: null,
}

function deps(overrides: Partial<SubmitDeps> = {}): SubmitDeps {
  return {
    send: vi.fn(async () => 'report-1'),
    save: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
    isOnline: () => true,
    ...overrides,
  }
}

describe('submitOrSave (offline draft handling)', () => {
  it('sends the report when online and clears any saved copy', async () => {
    const d = deps()
    await expect(submitOrSave(draft, d)).resolves.toEqual({ kind: 'sent', reportId: 'report-1' })
    expect(d.send).toHaveBeenCalledWith(draft)
    expect(d.remove).toHaveBeenCalledWith(draft.clientUuid)
    expect(d.save).not.toHaveBeenCalled()
  })

  it('saves the draft without trying to send when the device is offline', async () => {
    const d = deps({ isOnline: () => false })
    const outcome = await submitOrSave(draft, d)
    expect(outcome).toMatchObject({ kind: 'saved', reason: 'offline' })
    expect(d.send).not.toHaveBeenCalled()
    expect(d.save).toHaveBeenCalledWith(expect.objectContaining({ clientUuid: draft.clientUuid }))
  })

  it('saves the draft and counts the attempt when the connection fails', async () => {
    const d = deps({ send: vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))) })
    const outcome = await submitOrSave(draft, d)
    expect(outcome).toMatchObject({ kind: 'saved', reason: 'network' })
    expect(d.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1, lastError: 'Failed to fetch' }))
  })

  it('does not save rule violations; it throws so the form can show them', async () => {
    const d = deps({
      send: vi.fn(async () => Promise.reject(new Error('The location is outside the Municipality of Cuenca'))),
    })
    await expect(submitOrSave(draft, d)).rejects.toThrow('outside the Municipality')
    expect(d.save).not.toHaveBeenCalled()
  })

  it('keeps the same client UUID on retry so the server can de-duplicate', async () => {
    const send = vi.fn(async () => 'report-1')
    await submitOrSave({ ...draft, attempts: 2 }, deps({ send }))
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ clientUuid: draft.clientUuid }))
  })
})
