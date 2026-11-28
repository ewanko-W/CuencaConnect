import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDraft, getDraft, listDrafts, resetOutboxConnection, saveDraft } from './outbox'
import type { ReportDraft } from './types'

function makeDraft(clientUuid: string, userId: string, createdAt: string): ReportDraft {
  return {
    clientUuid,
    userId,
    category: 'road',
    description: 'Pothole near the plaza fountain.',
    lat: 13.91,
    lng: 121.05,
    accuracy: null,
    locationSource: 'manual',
    photos: [],
    createdAt,
    attempts: 0,
    lastError: null,
  }
}

describe('offline outbox (IndexedDB)', () => {
  beforeEach(async () => {
    resetOutboxConnection()
    for (const d of [...(await listDrafts('user-a')), ...(await listDrafts('user-b'))]) await deleteDraft(d.clientUuid)
  })

  it('keeps drafts until they are deleted', async () => {
    await saveDraft(makeDraft('d1', 'user-a', '2026-11-27T01:00:00Z'))
    expect(await getDraft('d1')).toMatchObject({ clientUuid: 'd1', description: 'Pothole near the plaza fountain.' })
    await deleteDraft('d1')
    expect(await getDraft('d1')).toBeUndefined()
  })

  it('lists only the signed-in user\'s drafts, oldest first', async () => {
    await saveDraft(makeDraft('late', 'user-a', '2026-11-27T05:00:00Z'))
    await saveDraft(makeDraft('early', 'user-a', '2026-11-27T01:00:00Z'))
    await saveDraft(makeDraft('other', 'user-b', '2026-11-27T02:00:00Z'))
    expect((await listDrafts('user-a')).map((d) => d.clientUuid)).toEqual(['early', 'late'])
    expect((await listDrafts('user-b')).map((d) => d.clientUuid)).toEqual(['other'])
  })

  it('updates a draft in place when it is saved again (e.g., after a failed retry)', async () => {
    await saveDraft(makeDraft('d1', 'user-a', '2026-11-27T01:00:00Z'))
    await saveDraft({ ...makeDraft('d1', 'user-a', '2026-11-27T01:00:00Z'), attempts: 2, lastError: 'Failed to fetch' })
    const drafts = await listDrafts('user-a')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ attempts: 2, lastError: 'Failed to fetch' })
  })
})
