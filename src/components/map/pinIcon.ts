import L from 'leaflet'
import * as ambulance from 'lucide-react/icons/ambulance'
import * as construction from 'lucide-react/icons/construction'
import * as flame from 'lucide-react/icons/flame'
import * as lightbulb from 'lucide-react/icons/lightbulb'
import * as mapPin from 'lucide-react/icons/map-pin'
import * as siren from 'lucide-react/icons/siren'
import * as trash from 'lucide-react/icons/trash'
import * as wavesHorizontal from 'lucide-react/icons/waves-horizontal'
import type { ReportCategory } from '../../lib/reports/types'

/**
 * HTML (divIcon) pins avoid Leaflet's default image markers, whose asset
 * paths break under bundlers, and let each category show its own icon.
 *
 * Leaflet needs an HTML string, so the pin SVG is built from the same
 * lucide icon data the React icons use (src/components/icons/categoryIcons.ts);
 * a test keeps the two in sync. This avoids bundling react-dom/server.
 */
export type PinVariant = 'default' | 'mine' | 'draft' | 'critical' | 'high' | 'medium' | 'low'

interface IconData {
  name: string
  node: [string, Record<string, string>][]
}

function data(module: unknown): IconData {
  const icon = (module as { __iconData?: IconData }).__iconData
  // Alias modules (e.g. trash-2, waves) only re-export; import the canonical icon instead.
  if (!icon) throw new Error('Lucide icon module has no __iconData; import the canonical icon name')
  return icon
}

export const PIN_ICON_DATA: Record<ReportCategory | 'location', IconData> = {
  fire: data(flame),
  flood: data(wavesHorizontal),
  medical: data(ambulance),
  crime: data(siren),
  road: data(construction),
  utilities: data(lightbulb),
  waste: data(trash),
  other: data(mapPin),
  location: data(mapPin),
}

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function iconSvg(icon: IconData, size = 20, strokeWidth = 2.25): string {
  const children = icon.node
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${escapeAttr(String(value))}"`)
        .join(' ')
      return `<${tag} ${attributes}/>`
    })
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${children}</svg>`
  )
}

const cache = new Map<string, L.DivIcon>()

export function pinIcon(category: ReportCategory | 'location', variant: PinVariant = 'default'): L.DivIcon {
  const key = `${category}:${variant}`
  const cached = cache.get(key)
  if (cached) return cached

  const icon = L.divIcon({
    className: `map-pin map-pin--${variant}`,
    html: `<span class="map-pin__body"><span class="map-pin__symbol">${iconSvg(PIN_ICON_DATA[category])}</span></span>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -44],
  })
  cache.set(key, icon)
  return icon
}
