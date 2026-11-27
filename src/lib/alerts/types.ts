export type AlertLevel = 'advisory' | 'warning' | 'emergency'

export interface Alert {
  id: string
  title: string
  body: string
  level: AlertLevel
  scope: 'municipality' | 'barangay'
  starts_at: string
  expires_at: string | null
}

export const LEVEL_RANK: Record<AlertLevel, number> = { emergency: 0, warning: 1, advisory: 2 }

export const LEVEL_LABELS: Record<AlertLevel, string> = {
  emergency: 'Emergency',
  warning: 'Warning',
  advisory: 'Advisory',
}

/** Most urgent first, then newest first. */
export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort(
    (a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || b.starts_at.localeCompare(a.starts_at),
  )
}
