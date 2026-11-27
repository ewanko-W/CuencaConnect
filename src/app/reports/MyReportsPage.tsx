import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/reports/StatusBadge'
import { VerificationGate } from '../../components/VerificationGate'
import { useAuth } from '../../lib/auth/AuthContext'
import { formatRelative } from '../../lib/format'
import { fetchMyReports } from '../../lib/reports/api'
import { useOutbox } from '../../lib/reports/OutboxContext'
import { CATEGORY_INFO } from '../../lib/reports/types'
import { useAsyncData } from '../../lib/useAsyncData'

export function MyReportsPage() {
  return (
    <section className="stack">
      <h1>My reports</h1>
      <OutboxList />
      <VerificationGate feature="Reporting">
        <SubmittedList />
      </VerificationGate>
    </section>
  )
}

/** Drafts saved on this device that still need to be sent. */
export function OutboxList() {
  const { drafts, sending, messages, retry, remove } = useOutbox()
  if (drafts.length === 0) return null

  return (
    <section className="card stack outbox" aria-labelledby="outbox-title">
      <h2 id="outbox-title">Waiting to send ({drafts.length})</h2>
      <p className="muted small">These reports are saved on this device only.</p>
      <ul className="list">
        {drafts.map((draft) => {
          const isSending = sending.includes(draft.clientUuid)
          return (
            <li key={draft.clientUuid} className="list__item">
              <div>
                <strong>
                  {CATEGORY_INFO[draft.category].icon} {CATEGORY_INFO[draft.category].label}
                </strong>
                <p className="small">{draft.description}</p>
                <p className="muted small">
                  Saved {formatRelative(draft.createdAt)}
                  {draft.photos.length > 0 && ` · ${draft.photos.length} photo(s)`}
                </p>
                {messages[draft.clientUuid] && <p className="field-error small">{messages[draft.clientUuid]}</p>}
              </div>
              <div className="list__actions">
                <button
                  type="button"
                  className="button button--primary button--small"
                  disabled={isSending}
                  onClick={() => void retry(draft.clientUuid)}
                >
                  {isSending ? 'Sending…' : 'Retry'}
                </button>
                <button
                  type="button"
                  className="button button--small"
                  disabled={isSending}
                  onClick={() => {
                    if (window.confirm('Delete this unsent report from this device?')) void remove(draft.clientUuid)
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function SubmittedList() {
  const { session } = useAuth()
  const { drafts } = useOutbox()
  const userId = session?.user.id ?? ''
  // Reload when the outbox shrinks (a draft was just sent).
  const { data, error, loading, reload } = useAsyncData(() => fetchMyReports(userId), [userId, drafts.length])

  if (loading && !data) return <p role="status">Loading your reports…</p>
  if (error)
    return (
      <div className="alert alert--error" role="alert">
        <p>{error}</p>
        <button type="button" className="button button--small" onClick={reload}>
          Try again
        </button>
      </div>
    )
  if (!data || data.length === 0)
    return (
      <div className="card">
        <p>You have not sent any reports yet.</p>
        <Link to="/app/report" className="button button--primary">
          Report an incident
        </Link>
      </div>
    )

  return (
    <ul className="list" aria-label="Submitted reports">
      {data.map((report) => (
        <li key={report.id}>
          <Link to={`/app/reports/${report.id}`} className="list__item list__item--link card">
            <div>
              <strong>
                {CATEGORY_INFO[report.category].icon} {CATEGORY_INFO[report.category].label}
              </strong>
              <p className="small clamp-2">{report.description}</p>
              <p className="muted small">
                {formatRelative(report.created_at)} · 👍 {report.confirm_count} · 👎 {report.dispute_count}
              </p>
            </div>
            <StatusBadge status={report.status} />
          </Link>
        </li>
      ))}
    </ul>
  )
}
