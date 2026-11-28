import { ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { castVote, withdrawVote } from '../../lib/reports/api'
import type { VoteResult, VoteType } from '../../lib/reports/types'

/**
 * Confirm / Dispute toggle. One vote per user per report is enforced by the
 * database; choosing the other option switches the vote, and choosing the
 * current option again withdraws it.
 */
export function VoteButtons({
  reportId,
  initial,
  disabledReason,
  onChange,
}: {
  reportId: string
  initial: VoteResult
  /** When set, voting is unavailable and this text is shown instead. */
  disabledReason?: string
  onChange?: (result: VoteResult) => void
}) {
  const [result, setResult] = useState<VoteResult>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(vote: VoteType) {
    setBusy(true)
    setError(null)
    try {
      const next = result.my_vote === vote ? await withdrawVote(reportId) : await castVote(reportId, vote)
      setResult(next)
      onChange?.(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your vote was not saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="vote">
      <div className="vote__buttons" role="group" aria-label="Is this incident real?">
        <button
          type="button"
          className="button vote__button vote__button--confirm"
          aria-pressed={result.my_vote === 'confirm'}
          disabled={busy || Boolean(disabledReason)}
          onClick={() => void choose('confirm')}
        >
          <ThumbsUp size={18} aria-hidden="true" /> Confirm <span className="vote__count">{result.confirm_count}</span>
        </button>
        <button
          type="button"
          className="button vote__button vote__button--dispute"
          aria-pressed={result.my_vote === 'dispute'}
          disabled={busy || Boolean(disabledReason)}
          onClick={() => void choose('dispute')}
        >
          <ThumbsDown size={18} aria-hidden="true" /> Dispute <span className="vote__count">{result.dispute_count}</span>
        </button>
      </div>
      {disabledReason && <p className="muted small">{disabledReason}</p>}
      {result.my_vote && !disabledReason && (
        <p className="muted small">Tap your choice again to remove your vote.</p>
      )}
      {error && (
        <p className="field-error small" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
