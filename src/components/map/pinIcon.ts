import L from 'leaflet'

/**
 * HTML (divIcon) pins avoid Leaflet's default image markers, whose asset
 * paths break under bundlers, and let each category show its own icon.
 */
export function pinIcon(symbol: string, variant: 'default' | 'mine' | 'draft' = 'default'): L.DivIcon {
  return L.divIcon({
    className: `map-pin map-pin--${variant}`,
    html: `<span class="map-pin__body"><span class="map-pin__symbol">${symbol}</span></span>`,
    iconSize: [40, 48],
    iconAnchor: [20, 46],
    popupAnchor: [0, -44],
  })
}
