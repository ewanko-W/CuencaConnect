import { useEffect, useMemo } from 'react'
import { Circle, Marker, useMap, useMapEvents } from 'react-leaflet'
import type { LatLng } from '../../lib/geo/cuenca'
import { BaseMap } from './BaseMap'
import { pinIcon } from './pinIcon'

function Recenter({ target }: { target: LatLng | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.setView([target.lat, target.lng], Math.max(map.getZoom(), 17))
  }, [map, target])
  return null
}

function TapToMove({ onMove }: { onMove: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onMove({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

/**
 * Shows the GPS fix as a draggable pin. Dragging the pin or tapping the map
 * corrects the location (reported as location_source "adjusted"/"manual").
 */
export function LocationPicker({
  value,
  accuracy,
  recenterOn,
  fallbackCenter,
  onChange,
}: {
  value: LatLng | null
  accuracy: number | null
  /** Changes when a new GPS fix arrives, to recenter the map. */
  recenterOn: LatLng | null
  fallbackCenter: LatLng
  onChange: (position: LatLng) => void
}) {
  const icon = useMemo(() => pinIcon('location', 'draft'), [])
  const handlers = useMemo(
    () => ({
      dragend: (e: { target: { getLatLng: () => { lat: number; lng: number } } }) => {
        const p = e.target.getLatLng()
        onChange({ lat: p.lat, lng: p.lng })
      },
    }),
    [onChange],
  )

  return (
    <BaseMap center={value ?? fallbackCenter} label="Incident location map. Drag the pin to adjust." className="map map--picker">
      <Recenter target={recenterOn} />
      <TapToMove onMove={onChange} />
      {value && accuracy !== null && accuracy > 0 && (
        <Circle center={[value.lat, value.lng]} radius={accuracy} pathOptions={{ weight: 1, fillOpacity: 0.1 }} />
      )}
      {value && (
        <Marker
          position={[value.lat, value.lng]}
          draggable
          icon={icon}
          eventHandlers={handlers}
          keyboard
          title="Incident location (drag to adjust)"
        />
      )}
    </BaseMap>
  )
}
