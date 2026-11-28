import { useCallback, useEffect, useState } from 'react'
import type { LatLng } from './cuenca'

export interface GpsFix extends LatLng {
  accuracy: number
}

/**
 * Fixes less precise than this (in meters) are treated as approximate.
 * Desktops and phones without GPS often report a network-based location
 * with an accuracy of several kilometers, which must not become a pin.
 */
export const MAX_USABLE_ACCURACY_M = 500

export function isUsableFix(fix: GpsFix | null): fix is GpsFix {
  return fix !== null && Number.isFinite(fix.accuracy) && fix.accuracy <= MAX_USABLE_ACCURACY_M
}

/** "about 50 km" / "about 800 m" for messages. */
export function describeAccuracy(meters: number): string {
  return meters >= 1000 ? `about ${Math.round(meters / 1000)} km` : `about ${Math.round(meters)} m`
}

export type GeoState =
  | { status: 'idle' }
  | { status: 'locating' }
  | { status: 'ok'; fix: GpsFix }
  | { status: 'error'; message: string }

function describeError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. Drag the pin or tap the map to set the location.'
    case error.POSITION_UNAVAILABLE:
      return 'Your location is unavailable. Drag the pin or tap the map to set the location.'
    case error.TIMEOUT:
      return 'Finding your location took too long. Try again or set the pin manually.'
    default:
      return 'Could not get your location.'
  }
}

function supported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation)
}

const UNSUPPORTED: GeoState = { status: 'error', message: 'This device does not support GPS location.' }

/**
 * High-accuracy GPS lookup. Requires HTTPS (or localhost).
 * With `auto`, the lookup starts when the component mounts.
 */
export function useGeolocation({ auto = false }: { auto?: boolean } = {}) {
  const [state, setState] = useState<GeoState>(() => {
    if (!auto) return { status: 'idle' }
    return supported() ? { status: 'locating' } : UNSUPPORTED
  })

  const request = useCallback((onDone?: (fix: GpsFix | null) => void) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }
        setState({ status: 'ok', fix })
        onDone?.(fix)
      },
      (err) => {
        setState({ status: 'error', message: describeError(err) })
        onDone?.(null)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }, [])

  useEffect(() => {
    if (auto && supported()) request()
  }, [auto, request])

  /** Asks for a fresh fix (e.g., the "Use my current location" button). */
  const locate = useCallback((): Promise<GpsFix | null> => {
    if (!supported()) {
      setState(UNSUPPORTED)
      return Promise.resolve(null)
    }
    setState({ status: 'locating' })
    return new Promise((resolve) => request(resolve))
  }, [request])

  return { state, locate, fix: state.status === 'ok' ? state.fix : null }
}
