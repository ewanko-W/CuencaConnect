import { Link, useLocation, useParams } from 'react-router-dom'
import { StatusBadge } from '../../components/reports/StatusBadge'
import { StatusTimeline } from '../../components/reports/StatusTimeline'
import { formatDateTime } from '../../lib/format'
import { fetchReportDetail } from '../../lib/reports/api'
import { CATEGORY_INFO } from '../../lib/reports/types'
import { useAsyncData } from '../../lib/useAsyncData'

export function ReportDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const justSubmitted = (location.state as { justSubmitted?: boolean } | null)?.justSubmitted
  const { data: report, error, loading, reload } = useAsyncData(() => fetchReportDetail(id), [id])

  return (
    <section className="stack">
      <Link to="/app/reports" className="back-link">
        ← My reports
      </Link>

      {justSubmitted && (
        <p className="alert alert--success" role="status">
          Report sent. The municipality will review it.
        </p>
      )}

      {loading && !report && <p role="status">Loading report…</p>}
      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button--small" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {report && (
        <>
          <header className="report-header">
            <h1>
              {CATEGORY_INFO[report.category].icon} {CATEGORY_INFO[report.category].label}
            </h1>
            <StatusBadge status={report.status} />
          </header>
          <p className="muted small">Reported {formatDateTime(report.created_at)}</p>

          <section className="card">
            <h2>Status</h2>
            <StatusTimeline status={report.status} events={report.events} />
          </section>

          <section className="card stack">
            <h2>Details</h2>
            <p>{report.description}</p>
            <p className="muted small">
              Location: {report.lat.toFixed(5)}, {report.lng.toFixed(5)} (
              {report.location_source === 'gps' ? 'GPS' : 'adjusted on the map'})
            </p>
            <p className="muted small">
              Nearby residents: 👍 {report.confirm_count} confirmed · 👎 {report.dispute_count} disputed
            </p>
          </section>

          {report.photoUrls.length > 0 && (
            <section className="card">
              <h2>Photos</h2>
              <div className="photo-grid">
                {report.photoUrls.map((url, i) => (
                  <img key={url} src={url} alt={`Report photo ${i + 1}`} className="photo-thumb" />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  )
}
