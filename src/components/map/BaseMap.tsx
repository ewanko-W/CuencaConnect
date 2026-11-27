import 'leaflet/dist/leaflet.css'
import type { ReactNode } from 'react'
import { MapContainer, TileLayer } from 'react-leaflet'
import type { LatLng } from '../../lib/geo/cuenca'

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

/** Leaflet map with OpenStreetMap tiles. crossOrigin lets the service worker cache tiles. */
export function BaseMap({
  center,
  zoom = 16,
  className = 'map',
  label,
  children,
}: {
  center: LatLng
  zoom?: number
  className?: string
  label: string
  children?: ReactNode
}) {
  return (
    <div className={className} role="region" aria-label={label}>
      <MapContainer center={[center.lat, center.lng]} zoom={zoom} scrollWheelZoom={false} style={{ height: '100%' }}>
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} crossOrigin maxZoom={19} />
        {children}
      </MapContainer>
    </div>
  )
}
