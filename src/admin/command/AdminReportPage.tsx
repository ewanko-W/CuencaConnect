import { useState, type FormEvent } from 'react'
import { Marker } from 'react-leaflet'
import { Link, useParams } from 'react-router-dom'
import { SeverityBadge } from '../../components/admin/SeverityBadge'
import { BaseMap } from '../../components/map/BaseMap'
import { pinIcon } from '../../components/map/pinIcon'
import { StatusBadge } from '../../components/reports/StatusBadge'
import { StatusTimeline } from '../../components/reports/StatusTimeline'
import { fetchActiveOffices, fetchAdminReport, routeReport, setReportStatus } from '../../lib/admin/api'
import { canRoute, statusActions, type StatusAction } from '../../lib/admin/statusActions'
import type { AdminOffice, AdminReportDetail } from '../../lib/admin/types'
import { formatDateTime } from '../../lib/format'
import { CATEGORY_INFO } from '../../lib/reports/types'
import { useAsyncData } from '../../lib/useAsyncData'

export function AdminReportPage() {
  const { id = '' } = useParams()
  const report = useAsyncData(() => fetchAdminReport(id), [id])
  const offices = useAsyncData(fetchActiveOffices, [])
  const r = report.data

  return (
    <section className="stack">
      <Link to="/admin/command" className="back-link">
        ← Command Center
      </Link>

      {report.loading && !r && <p role="status">Loading report…</p>}
      {report.error && (
        <div className="alert alert--error" role="alert">
          {report.error}
        </div>
      )}

      {r && (
        <>
          <header className="report-header">
            <h1>
              {CATEGORY_INFO[r.category].icon} {CATEGORY_INFO[r.category].label}{' '}
              <small className="muted">/ {CATEGORY_INFO[r.category].filipino}</small>
            </h1>
            <div className="badge-row">
              <SeverityBadge severity={r.severity} />
              <StatusBadge status={r.status} />
            </div>
          </header>

          <div className="detail-grid">
            <div className="stack">
              <section className="card stack">
                <h2>Report</h2>
                <p className="lead">{r.description}</p>
                <dl className="details">
                  <dt>Reported</dt>
                  <dd>{formatDateTime(r.created_at)}</dd>
                  <dt>Reporter</dt>
                  <dd>{r.reporter?.display_name ?? 'Unknown'}</dd>
                  <dt>Barangay</dt>
                  <dd>{r.barangay?.name ?? 'Not set'}</dd>
                  <dt>Location</dt>
                  <dd>
                    {r.lat.toFixed(5)}, {r.lng.toFixed(5)} ({r.location_source}
                    {r.gps_accuracy_m ? `, ±${Math.round(r.gps_accuracy_m)} m` : ''})
                  </dd>
                  <dt>Community</dt>
                  <dd>
                    👍 {r.confirm_count} confirmed · 👎 {r.dispute_count} disputed
                  </dd>
                  <dt>Keywords</dt>
                  <dd>
                    {r.matched_keywords.length > 0 ? (
                      r.matched_keywords.map((k) => (
                        <span key={k} className="chip">
                          {k}
                        </span>
                      ))
                    ) : (
                      <span className="muted">None matched</span>
                    )}
                  </dd>
                  <dt>Priority score</dt>
                  <dd>{r.priority_score}</dd>
                </dl>
              </section>

              <BaseMap center={{ lat: r.lat, lng: r.lng }} zoom={17} label="Report location" className="map">
                <Marker position={[r.lat, r.lng]} icon={pinIcon(CATEGORY_INFO[r.category].icon, r.severity ?? 'default')} />
              </BaseMap>

              {r.photoUrls.length > 0 && (
                <section className="card">
                  <h2>Photos</h2>
                  <div className="photo-grid">
                    {r.photoUrls.map((url, i) => (
                      <a key={url} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Report photo ${i + 1}`} className="photo-thumb photo-thumb--large" />
                      </a>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="stack">
              <RoutingCard report={r} offices={offices.data ?? []} onDone={report.reload} />
              <StatusCard report={r} onDone={report.reload} />
              <section className="card">
                <h2>Timeline</h2>
                <StatusTimeline status={r.status} events={r.events} />
              </section>
              {r.routing.length > 0 && (
                <section className="card">
                  <h2>Routing history</h2>
                  <ol className="routing-list">
                    {r.routing.map((entry) => (
                      <li key={entry.id}>
                        <strong>
                          {entry.from_office ? `${entry.from_office.name} → ` : ''}
                          {entry.to_office?.name}
                        </strong>
                        <span className="muted small"> · {formatDateTime(entry.created_at)}</span>
                        {entry.note && <p className="small">{entry.note}</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function RoutingCard({
  report,
  offices,
  onDone,
}: {
  report: AdminReportDetail
  offices: AdminOffice[]
  onDone: () => void
}) {
  const initial = report.assigned_office?.id ?? report.suggested_office?.id ?? ''
  const [officeId, setOfficeId] = useState<number | ''>(initial)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const routable = canRoute(report.status)
  const unchanged = officeId === report.assigned_office?.id

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (officeId === '') return
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      await routeReport(report.id, officeId, note.trim())
      setNote('')
      setDone(`Sent to ${offices.find((o) => o.id === officeId)?.name ?? 'the office'}.`)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Routing failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="card stack" onSubmit={submit} aria-labelledby="routing-title">
      <h2 id="routing-title">Route to office</h2>
      <p className="small">
        {report.assigned_office ? (
          <>
            Assigned to <strong>{report.assigned_office.name}</strong>.
          </>
        ) : (
          <strong className="text-critical">Not routed yet.</strong>
        )}{' '}
        {report.suggested_office && (
          <span className="muted">Triage suggests ★ {report.suggested_office.name}.</span>
        )}
      </p>
      {routable ? (
        <>
          <label className="field">
            <span>Office</span>
            <select value={officeId === '' ? '' : String(officeId)} onChange={(e) => setOfficeId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select an office</option>
              {offices.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id === report.suggested_office?.id ? '★ ' : ''}
                  {o.name} ({o.code})
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Internal note (optional, not shown to the resident)</span>
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="submit" className="button button--primary" disabled={busy || officeId === '' || unchanged}>
            {busy ? 'Routing…' : report.assigned_office ? 'Re-route' : 'Route report'}
          </button>
        </>
      ) : (
        <p className="muted small">Closed reports cannot be routed. Reopen it first.</p>
      )}
      {done && (
        <p className="alert alert--success small" role="status">
          {done}
        </p>
      )}
      {error && (
        <p className="alert alert--error small" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

export function StatusCard({ report, onDone }: { report: AdminReportDetail; onDone: () => void }) {
  const actions = statusActions(report.status, report.assigned_office !== null)
  const [pending, setPending] = useState<StatusAction | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function apply(action: StatusAction, withNote: string) {
    setBusy(true)
    setError(null)
    try {
      await setReportStatus(report.id, action.to, withNote.trim())
      setPending(null)
      setNote('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The status was not changed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack" aria-labelledby="status-title">
      <h2 id="status-title">Update status</h2>
      {report.assigned_office === null && report.status === 'submitted' && (
        <p className="muted small">Route the report to an office to mark it received, in progress, or resolved.</p>
      )}
      <div className="button-row">
        {actions.map((action) => (
          <button
            key={action.to}
            type="button"
            className={`button button--${action.tone}`}
            disabled={busy}
            aria-pressed={pending?.to === action.to}
            onClick={() => {
              setError(null)
              setPending(action)
            }}
          >
            {action.label}
          </button>
        ))}
      </div>

      {pending && (
        <form
          className="stack status-confirm"
          onSubmit={(e) => {
            e.preventDefault()
            void apply(pending, note)
          }}
        >
          <label className="field">
            <span>
              Note for the resident{pending.needsNote ? ' (required)' : ' (optional)'}
            </span>
            <textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} required={pending.needsNote} />
          </label>
          <div className="button-row">
            <button type="submit" className="button button--primary" disabled={busy || (pending.needsNote && !note.trim())}>
              {busy ? 'Saving…' : `Confirm: ${pending.label}`}
            </button>
            <button type="button" className="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="alert alert--error small" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
