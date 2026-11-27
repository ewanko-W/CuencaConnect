import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ReportDraft } from './types'

/**
 * Offline outbox: reports that could not be sent are kept in IndexedDB on
 * this device (photos included, as Blobs) until they are sent or deleted.
 * Drafts are tagged with the user id so a shared phone never shows one
 * user's drafts to another.
 */
interface OutboxDb extends DBSchema {
  drafts: {
    key: string
    value: ReportDraft
    indexes: { byUser: string }
  }
}

const DB_NAME = 'cuencaconnect-outbox'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<OutboxDb>> | null = null

function db(): Promise<IDBPDatabase<OutboxDb>> {
  dbPromise ??= openDB<OutboxDb>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      const store = database.createObjectStore('drafts', { keyPath: 'clientUuid' })
      store.createIndex('byUser', 'userId')
    },
  })
  return dbPromise
}

export async function saveDraft(draft: ReportDraft): Promise<void> {
  await (await db()).put('drafts', draft)
}

export async function listDrafts(userId: string): Promise<ReportDraft[]> {
  const drafts = await (await db()).getAllFromIndex('drafts', 'byUser', userId)
  return drafts.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function getDraft(clientUuid: string): Promise<ReportDraft | undefined> {
  return (await db()).get('drafts', clientUuid)
}

export async function deleteDraft(clientUuid: string): Promise<void> {
  await (await db()).delete('drafts', clientUuid)
}

/** Test helper: forget the cached connection (used with fake-indexeddb). */
export function resetOutboxConnection(): void {
  dbPromise = null
}
