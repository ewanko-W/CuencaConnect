import type { CommunityStatus } from '../../lib/reports/types'

const LABELS: Record<CommunityStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: '✔ Community-confirmed',
  disputed: '⚠ Disputed',
}

/** Shows the community verification result; "pending" is hidden unless asked for. */
export function CommunityBadge({ status, showPending = false }: { status: CommunityStatus; showPending?: boolean }) {
  if (status === 'pending' && !showPending) return null
  return (
    <span className={`badge badge--community-${status}`} title="Based on Confirm/Dispute votes from verified residents">
      {LABELS[status]}
    </span>
  )
}

/** Explains why a disputed critical report is still shown. */
export function DisputedCriticalNote() {
  return (
    <p className="alert alert--warning small" role="note">
      Several residents disputed this report, but it stays visible because it may be an emergency. The
      municipality reviews it.
    </p>
  )
}
