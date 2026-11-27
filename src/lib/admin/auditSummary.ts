import type { AuditEntry } from './types'

/** One-line human summary of what changed. */
export function summarize(entry: AuditEntry): string {
  const n = entry.new_data ?? {}
  const o = entry.old_data ?? {}
  switch (entry.action) {
    case 'report.routed':
      return `Routed to office #${String(n.assigned_office_id)}${n.note ? ` (${String(n.note)})` : ''}`
    case 'report.status_changed':
      return `${String(o.status)} → ${String(n.status)}${n.note ? ` (${String(n.note)})` : ''}`
    case 'alerts.insert':
      return `Broadcast ${String(n.level)}: ${String(n.title)}`
    case 'keywords.insert':
      return `Added "${String(n.term)}" (${String(n.lang)}, ${String(n.severity)})`
    case 'keywords.delete':
      return `Deleted "${String(o.term)}" (${String(o.lang)})`
    default: {
      const changed = Object.keys(n).filter((k) => k !== 'updated_at' && JSON.stringify(n[k]) !== JSON.stringify(o[k]))
      return changed.length ? `Changed ${changed.join(', ')}` : entry.action
    }
  }
}
