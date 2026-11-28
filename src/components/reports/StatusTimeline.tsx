import { formatDateTime } from '../../lib/format'
import { buildTimeline } from '../../lib/reports/timeline'
import { STATUS_LABELS, type ReportStatus, type StatusEvent } from '../../lib/reports/types'

export function StatusTimeline({ status, events }: { status: ReportStatus; events: StatusEvent[] }) {
  const steps = buildTimeline(status, events)
  return (
    <ol className="timeline" aria-label="Report status timeline">
      {steps.map((step) => (
        <li
          key={step.status}
          className={`timeline__step timeline__step--${step.state}`}
          aria-current={step.state === 'current' ? 'step' : undefined}
        >
          <span className="timeline__dot" aria-hidden="true" />
          <div>
            <strong>{STATUS_LABELS[step.status]}</strong>
            {step.event ? (
              <>
                <time className="muted small" dateTime={step.event.created_at}>
                  {' '}
                  · {formatDateTime(step.event.created_at)}
                </time>
                {step.event.note && <p className="timeline__note">{step.event.note}</p>}
              </>
            ) : (
              step.state === 'upcoming' && <span className="muted small"> · Pending</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
