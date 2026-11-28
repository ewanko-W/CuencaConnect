import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { deleteDraft, getDraft, listDrafts } from './outbox'
import { OutboxContext, type OutboxState } from './OutboxContext'
import { retryDraft } from './submitOrSave'
import type { ReportDraft } from './types'

/**
 * Holds the signed-in resident's unsent reports and retries them when the
 * device comes back online (and when the app starts).
 */
export function OutboxProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [drafts, setDrafts] = useState<ReportDraft[]>([])
  const [sending, setSending] = useState<string[]>([])
  const [messages, setMessages] = useState<Record<string, string>>({})
  const inFlight = useRef(new Set<string>())

  const refresh = useCallback(async () => {
    try {
      setDrafts(await listDrafts(userId))
    } catch {
      setDrafts([]) // IndexedDB unavailable (e.g., some private modes)
    }
  }, [userId])

  const retry = useCallback(
    async (clientUuid: string) => {
      if (inFlight.current.has(clientUuid)) return
      const draft = await getDraft(clientUuid)
      if (!draft || draft.userId !== userId) return
      inFlight.current.add(clientUuid)
      setSending((s) => [...s, clientUuid])
      try {
        const outcome = await retryDraft(draft)
        setMessages((m) => ({
          ...m,
          [clientUuid]: outcome.kind === 'sent' ? 'Sent.' : outcome.message,
        }))
      } catch (error) {
        // A rule violation: keep the draft so the user can read why and delete it.
        setMessages((m) => ({ ...m, [clientUuid]: error instanceof Error ? error.message : 'Could not send.' }))
      } finally {
        inFlight.current.delete(clientUuid)
        setSending((s) => s.filter((id) => id !== clientUuid))
        await refresh()
      }
    },
    [refresh, userId],
  )

  const retryAll = useCallback(async () => {
    const current = await listDrafts(userId).catch(() => [])
    for (const draft of current) await retry(draft.clientUuid)
  }, [retry, userId])

  const remove = useCallback(
    async (clientUuid: string) => {
      await deleteDraft(clientUuid)
      await refresh()
    },
    [refresh],
  )

  useEffect(() => {
    void refresh().then(() => {
      if (navigator.onLine) void retryAll()
    })
    const onOnline = () => void retryAll()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [refresh, retryAll])

  const value = useMemo<OutboxState>(
    () => ({ drafts, sending, messages, refresh, retry, retryAll, remove }),
    [drafts, sending, messages, refresh, retry, retryAll, remove],
  )

  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>
}
