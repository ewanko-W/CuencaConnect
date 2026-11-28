import { ThumbsDown, ThumbsUp } from 'lucide-react'

/** Confirm/Dispute counts with icons and readable text for screen readers. */
export function VoteCounts({
  confirms,
  disputes,
  compact = false,
}: {
  confirms: number
  disputes: number
  compact?: boolean
}) {
  return (
    <span className="vote-counts">
      <span className="with-icon" title={`${confirms} confirmed`}>
        <ThumbsUp size={14} aria-hidden="true" />
        {compact ? <span aria-label={`${confirms} confirmed`}>{confirms}</span> : `${confirms} confirmed`}
      </span>
      <span className="with-icon" title={`${disputes} disputed`}>
        <ThumbsDown size={14} aria-hidden="true" />
        {compact ? <span aria-label={`${disputes} disputed`}>{disputes}</span> : `${disputes} disputed`}
      </span>
    </span>
  )
}
