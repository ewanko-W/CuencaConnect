export interface LatLng {
  lat: number
  lng: number
}

/** Approximate town center of Cuenca, Batangas (default map view). */
export const CUENCA_CENTER: LatLng = { lat: 13.9094, lng: 121.0503 }

/**
 * Approximate municipal bounding box. MUST match public.is_within_cuenca()
 * in supabase/migrations/20261127000300_reports_media_votes.sql; the
 * database is the authority, this copy only gives early feedback.
 */
export const CUENCA_BOUNDS = { minLat: 13.84, maxLat: 13.98, minLng: 120.98, maxLng: 121.12 } as const

export function isWithinCuenca({ lat, lng }: LatLng): boolean {
  return (
    lat >= CUENCA_BOUNDS.minLat &&
    lat <= CUENCA_BOUNDS.maxLat &&
    lng >= CUENCA_BOUNDS.minLng &&
    lng <= CUENCA_BOUNDS.maxLng
  )
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}
