import { useAlerts } from '../../lib/alerts/AlertsContext'
import { LEVEL_LABELS, type Alert } from '../../lib/alerts/types'
import { formatDateTime } from '../../lib/format'

export function AlertCard({ alert }: { alert: Alert }) {
  return (
    <article className={`card alert-card alert-card--${alert.level}`} aria-labelledby={`alert-${alert.id}`}>
      <p className={`badge badge--${alert.level}`}>{LEVEL_LABELS[alert.level]}</p>
      <h2 id={`alert-${alert.id}`}>{alert.title}</h2>
      <p>{alert.body}</p>
      <p className="muted small">
        {alert.scope === 'barangay' ? 'For your barangay' : 'For all of Cuenca'} · {formatDateTime(alert.starts_at)}
        {alert.expires_at && ` · until ${formatDateTime(alert.expires_at)}`}
      </p>
    </article>
  )
}

export function AlertsPage() {
  const { alerts, loading, error, live, reload } = useAlerts()

  return (
    <section className="stack">
      <header className="report-header">
        <h1>Alerts</h1>
        <span className={`live-indicator${live ? ' live-indicator--on' : ''}`} role="status">
          {live ? '● Live' : '○ Connecting…'}
        </span>
      </header>

      {loading && alerts.length === 0 && <p role="status">Loading alerts…</p>}
      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button--small" onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {!loading && !error && alerts.length === 0 && (
        <p className="card">There are no active alerts for your area.</p>
      )}

      <div className="stack" aria-live="polite">
        {alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  )
}
