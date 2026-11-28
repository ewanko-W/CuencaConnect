import { X } from 'lucide-react'
import { CategoryLabel } from '../../components/icons/CategoryLabel'
import { useMemo, useState } from 'react'
import { Marker } from 'react-leaflet'
import { BaseMap } from '../../components/map/BaseMap'
import { pinIcon } from '../../components/map/pinIcon'
import { CommunityBadge, DisputedCriticalNote } from '../../components/reports/CommunityBadge'
import { StatusBadge } from '../../components/reports/StatusBadge'
import { VoteButtons } from '../../components/reports/VoteButtons'
import { VerificationGate } from '../../components/VerificationGate'
import { formatRelative } from '../../lib/format'
import { CUENCA_CENTER, formatDistance, isWithinCuenca, type LatLng } from '../../lib/geo/cuenca'
import { useGeolocation } from '../../lib/geo/useGeolocation'
import { fetchNearbyReports } from '../../lib/reports/api'
import { CATEGORY_INFO, type NearbyReport, type VoteResult } from '../../lib/reports/types'
import { useAsyncData } from '../../lib/useAsyncData'

const RADIUS_M = 3000

export function NearbyMapPage() {
  return (
    <section className="stack">
      <h1>Nearby incidents</h1>
      <VerificationGate feature="The incident map">
        <NearbyMap />
      </VerificationGate>
    </section>
  )
}

function NearbyMap() {
  const { state: geo, fix } = useGeolocation({ auto: true })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<Record<string, VoteResult>>({})

  // Outside Cuenca (e.g., testing elsewhere): use the town center instead.
  const center: LatLng = fix && isWithinCuenca(fix) ? { lat: fix.lat, lng: fix.lng } : CUENCA_CENTER

  const { data, error, loading, reload } = useAsyncData(
    () => fetchNearbyReports(center.lat, center.lng, RADIUS_M),
    [center.lat, center.lng],
  )

  const reports = useMemo(
    () => (data ?? []).map((r) => ({ ...r, ...(overrides[r.id] ?? {}) })),
    [data, overrides],
  )
  const selected = reports.find((r) => r.id === selectedId) ?? null

  function recordVote(id: string, result: VoteResult) {
    setOverrides((o) => ({ ...o, [id]: result }))
  }

  return (
    <div className="stack">
      <p className="muted small" aria-live="polite">
        {geo.status === 'locating'
          ? 'Finding your location…'
          : `Active incidents within ${formatDistance(RADIUS_M)}. Locations are approximate.`}
      </p>

      <BaseMap center={center} zoom={15} label="Map of nearby incidents" className="map map--nearby">
        {reports.map((r) => (
          <Marker
            key={r.id}
            position={[r.approx_lat, r.approx_lng]}
            icon={pinIcon(r.category, r.is_mine ? 'mine' : 'default')}
            title={`${CATEGORY_INFO[r.category].label}, ${formatDistance(r.distance_m)} away`}
            eventHandlers={{ click: () => setSelectedId(r.id) }}
          />
        ))}
      </BaseMap>

      {selected && (
        <IncidentCard key={selected.id} report={selected} onVote={recordVote} onClose={() => setSelectedId(null)} />
      )}

      {loading && !data && <p role="status">Loading incidents…</p>}
      {error && (
        <div className="alert alert--error" role="alert">
          <p>{error}</p>
          <button type="button" className="button button--small" onClick={reload}>
            Try again
          </button>
        </div>
      )}

      {data && (
        <section aria-labelledby="incident-list-title">
          <h2 id="incident-list-title">
            {reports.length === 0 ? 'No active incidents nearby' : `${reports.length} active incident(s)`}
          </h2>
          <ul className="list">
            {reports.map((r) => (
              <li key={r.id}>
                <button type="button" className="list__item list__item--button card" onClick={() => setSelectedId(r.id)}>
                  <span>
                    <strong>
                      <CategoryLabel category={r.category} />
                    </strong>
                    <span className="muted small">
                      {' '}
                      · {formatDistance(r.distance_m)} · {formatRelative(r.created_at)}
                      {r.is_mine && ' · Your report'}
                    </span>
                  </span>
                  <span className="badge-row">
                    {r.is_critical && <span className="badge badge--sev-critical">Critical</span>}
                    <CommunityBadge status={r.community_status} />
                    <StatusBadge status={r.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

export function IncidentCard({
  report,
  onVote,
  onClose,
}: {
  report: NearbyReport
  onVote: (id: string, result: VoteResult) => void
  onClose: () => void
}) {
  const info = CATEGORY_INFO[report.category]
  return (
    <article className="card stack incident-card" aria-label={`${info.label} incident`}>
      <header className="report-header">
        <h2>
          <CategoryLabel category={report.category} showFilipino size={22} />
        </h2>
        <button type="button" className="button button--small" onClick={onClose} aria-label="Close incident details">
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <p className="badge-row">
        {report.is_critical && <span className="badge badge--sev-critical">Critical</span>}
        <StatusBadge status={report.status} />
        <CommunityBadge status={report.community_status} />
      </p>
      <p className="muted small">
        {formatDistance(report.distance_m)} away · reported {formatRelative(report.created_at)}
      </p>
      {report.is_critical && report.community_status === 'disputed' && <DisputedCriticalNote />}
      <p className="small">Have you seen this? Your vote helps responders prioritize.</p>
      <VoteButtons
        reportId={report.id}
        initial={{ confirm_count: report.confirm_count, dispute_count: report.dispute_count, my_vote: report.my_vote }}
        disabledReason={report.is_mine ? 'This is your report. You cannot vote on it.' : undefined}
        onChange={(result) => onVote(report.id, result)}
      />
    </article>
  )
}
