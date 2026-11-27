import { useEffect } from 'react'
import { Marker, Tooltip, useMap } from 'react-leaflet'
import type { AdminReport } from '../../lib/admin/types'
import { CUENCA_CENTER } from '../../lib/geo/cuenca'
import { CATEGORY_INFO, STATUS_LABELS } from '../../lib/reports/types'
import { BaseMap } from '../map/BaseMap'
import { pinIcon } from '../map/pinIcon'

/** Zooms to show every pin whenever the set of reports changes. */
function FitToReports({ reports }: { reports: AdminReport[] }) {
  const map = useMap()
  const key = reports.map((r) => r.id).join(',')
  useEffect(() => {
    if (reports.length === 0) return
    map.fitBounds(
      reports.map((r) => [r.lat, r.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 17 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

/** All filtered reports at their exact location, colored by priority. */
export function ReportsMap({
  reports,
  selectedId,
  onSelect,
}: {
  reports: AdminReport[]
  selectedId?: string | null
  onSelect: (id: string) => void
}) {
  return (
    <BaseMap center={CUENCA_CENTER} zoom={14} label="Map of reports" className="map map--admin">
      <FitToReports reports={reports} />
      {reports.map((r) => (
        <Marker
          key={r.id}
          position={[r.lat, r.lng]}
          icon={pinIcon(CATEGORY_INFO[r.category].icon, r.severity ?? 'default')}
          zIndexOffset={(r.is_critical ? 1000 : 0) + (r.id === selectedId ? 2000 : 0)}
          eventHandlers={{ click: () => onSelect(r.id) }}
          title={`${CATEGORY_INFO[r.category].label}: ${STATUS_LABELS[r.status]}`}
        >
          <Tooltip direction="top" offset={[0, -40]}>
            {CATEGORY_INFO[r.category].label} · {STATUS_LABELS[r.status]}
            {r.barangay ? ` · ${r.barangay.name}` : ''}
          </Tooltip>
        </Marker>
      ))}
    </BaseMap>
  )
}
