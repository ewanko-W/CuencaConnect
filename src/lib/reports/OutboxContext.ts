import { createContext, useContext } from 'react'
import type { ReportDraft } from './types'

export interface OutboxState {
  drafts: ReportDraft[]
  sending: string[]
  /** Last outcome message per draft, e.g. a rule violation from the server. */
  messages: Record<string, string>
  refresh: () => Promise<void>
  retry: (clientUuid: string) => Promise<void>
  retryAll: () => Promise<void>
  remove: (clientUuid: string) => Promise<void>
}

export const emptyOutbox: OutboxState = {
  drafts: [],
  sending: [],
  messages: {},
  refresh: async () => {},
  retry: async () => {},
  retryAll: async () => {},
  remove: async () => {},
}

export const OutboxContext = createContext<OutboxState>(emptyOutbox)

export function useOutbox(): OutboxState {
  return useContext(OutboxContext)
}
