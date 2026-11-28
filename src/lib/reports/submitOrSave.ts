import { isRetryableError, sendReport } from './api'
import { deleteDraft, saveDraft } from './outbox'
import type { ReportDraft } from './types'

export type SubmitOutcome =
  | { kind: 'sent'; reportId: string }
  | { kind: 'saved'; reason: 'offline' | 'network'; message: string }

export interface SubmitDeps {
  send: (draft: ReportDraft) => Promise<string>
  save: (draft: ReportDraft) => Promise<void>
  remove: (clientUuid: string) => Promise<void>
  isOnline: () => boolean
}

const defaultDeps: SubmitDeps = {
  send: sendReport,
  save: saveDraft,
  remove: deleteDraft,
  isOnline: () => (typeof navigator === 'undefined' ? true : navigator.onLine),
}

/**
 * Tries to send a report. If the device is offline or the connection fails,
 * the draft is kept in the outbox for a later retry. Rule violations (e.g.,
 * not verified, outside Cuenca) are thrown so the form can show them.
 */
export async function submitOrSave(draft: ReportDraft, deps: SubmitDeps = defaultDeps): Promise<SubmitOutcome> {
  if (!deps.isOnline()) {
    await deps.save({ ...draft, lastError: 'You were offline.' })
    return { kind: 'saved', reason: 'offline', message: 'You are offline. The report is saved on this device.' }
  }

  try {
    const reportId = await deps.send(draft)
    await deps.remove(draft.clientUuid) // in case it was a retry of a saved draft
    return { kind: 'sent', reportId }
  } catch (error) {
    if (!isRetryableError(error)) throw error
    await deps.save({
      ...draft,
      attempts: draft.attempts + 1,
      lastError: error instanceof Error ? error.message : 'Network error',
    })
    return { kind: 'saved', reason: 'network', message: 'The connection failed. The report is saved on this device.' }
  }
}

/** Retries a saved draft; throws rule violations, keeps it on network errors. */
export async function retryDraft(draft: ReportDraft, deps: SubmitDeps = defaultDeps): Promise<SubmitOutcome> {
  return submitOrSave(draft, deps)
}
