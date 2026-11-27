import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isRetryableError, OFFLINE_LOAD_MESSAGE } from '../network'
import { supabase } from '../supabaseClient'
import { AlertsContext, type AlertsState } from './AlertsContext'
import { sortAlerts, type Alert } from './types'

const ALERT_COLUMNS = 'id, title, body, level, scope, starts_at, expires_at'

type FetchResult = { alerts: Alert[]; error: null } | { alerts: null; error: string }

async function fetchAlerts(client: SupabaseClient): Promise<FetchResult> {
  try {
    const { data, error } = await client.from('alerts').select(ALERT_COLUMNS)
    if (error) return { alerts: null, error: isRetryableError(error) ? OFFLINE_LOAD_MESSAGE : error.message }
    return { alerts: sortAlerts(data as Alert[]), error: null }
  } catch (err) {
    return { alerts: null, error: isRetryableError(err) ? OFFLINE_LOAD_MESSAGE : 'Could not load alerts.' }
  }
}

/**
 * Loads the alerts visible to the user (RLS applies barangay targeting and
 * expiry) and reloads them whenever Supabase Realtime reports a change to
 * the alerts table. Reloading, instead of applying the change payload,
 * keeps the list consistent with RLS (e.g., deactivated or expired alerts).
 */
export function AlertsProvider({
  children,
  client = supabase,
}: {
  children: ReactNode
  client?: SupabaseClient | null
}) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(client !== null)
  const [error, setError] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  const apply = useCallback((result: FetchResult) => {
    setError(result.error)
    if (result.alerts) setAlerts(result.alerts)
    setLoading(false)
  }, [])

  const reload = useCallback(() => {
    if (client) void fetchAlerts(client).then(apply)
  }, [apply, client])

  useEffect(() => {
    if (!client) return
    let active = true
    const refresh = () =>
      void fetchAlerts(client).then((result) => {
        if (active) apply(result)
      })

    refresh()
    const channel = client
      .channel('alerts-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, refresh)
      .subscribe((status) => setLive(status === 'SUBSCRIBED'))

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', refresh)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', refresh)
      void client.removeChannel(channel)
    }
  }, [apply, client])

  const value = useMemo<AlertsState>(
    () => ({ alerts, loading, error, live, reload }),
    [alerts, loading, error, live, reload],
  )
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}
