import type { ReportStatus } from '../reports/types'

export interface StatusAction {
  to: ReportStatus
  label: string
  /** A note is required by set_report_status for this change. */
  needsNote: boolean
  tone: 'primary' | 'default' | 'danger'
}

/**
 * Mirrors public.is_allowed_status_transition() and the checks in
 * set_report_status() so the UI only offers valid buttons. The database
 * remains the authority and rejects anything else.
 */
const TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  submitted: ['rejected', 'duplicate'],
  routed: ['acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate'],
  acknowledged: ['in_progress', 'resolved', 'rejected', 'duplicate'],
  in_progress: ['resolved'],
  resolved: ['in_progress'],
  rejected: ['submitted'],
  duplicate: ['submitted'],
}

const CLOSED: ReportStatus[] = ['resolved', 'rejected', 'duplicate']

function label(from: ReportStatus, to: ReportStatus): string {
  if (CLOSED.includes(from)) return 'Reopen'
  switch (to) {
    case 'acknowledged':
      return 'Received'
    case 'in_progress':
      return 'In progress'
    case 'resolved':
      return 'Resolved'
    case 'rejected':
      return 'Reject'
    case 'duplicate':
      return 'Duplicate'
    default:
      return to
  }
}

export function statusActions(status: ReportStatus, isRouted: boolean): StatusAction[] {
  return TRANSITIONS[status]
    .filter((to) => isRouted || !['acknowledged', 'in_progress', 'resolved'].includes(to))
    .map((to) => ({
      to,
      label: label(status, to),
      needsNote: to === 'rejected' || to === 'duplicate' || CLOSED.includes(status),
      tone: to === 'rejected' || to === 'duplicate' ? 'danger' : to === 'resolved' ? 'primary' : 'default',
    }))
}

export function canRoute(status: ReportStatus): boolean {
  return !CLOSED.includes(status)
}
