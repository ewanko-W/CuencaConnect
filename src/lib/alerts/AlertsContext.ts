import { createContext, useContext } from 'react'
import type { Alert } from './types'

export interface AlertsState {
  alerts: Alert[]
  loading: boolean
  error: string | null
  /** True while the Realtime channel is subscribed. */
  live: boolean
  reload: () => void
}

export const AlertsContext = createContext<AlertsState>({
  alerts: [],
  loading: false,
  error: null,
  live: false,
  reload: () => {},
})

export function useAlerts(): AlertsState {
  return useContext(AlertsContext)
}
