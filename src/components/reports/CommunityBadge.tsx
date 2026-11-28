import { BadgeCheck, Clock, TriangleAlert } from 'lucide-react'
import type { CommunityStatus } from '../../lib/reports/types'

const ICONS = { pending: Clock, confirmed: BadgeCheck, disputed: TriangleAlert }

const LABELS: Record<CommunityStatus, string> = {
  pending: 'Awaiting confirmation',
  confirmed: 'Community-confirmed',
  disputed: 'Disputed',
}

/** Shows the community verification result; "pending" is hidden unless asked for. */
export function CommunityBadge({ status, showPending = false }: { status: CommunityStatus; showPending?: boolean }) {
  if (status === 'pending' && !showPending) return null
  const Icon = ICONS[status]
  return (
    <span
      className={`badge with-icon badge--community-${status}`}
      title="Based on Confirm/Dispute votes from verified residents"
    >
      <Icon size={14} aria-hidden="true" />
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
