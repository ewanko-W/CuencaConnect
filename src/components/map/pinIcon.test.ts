import { describe, expect, it } from 'vitest'
import { REPORT_CATEGORIES } from '../../lib/reports/types'
import { CATEGORY_ICONS } from '../icons/categoryIcons'
import { PIN_ICON_DATA, iconSvg, pinIcon } from './pinIcon'

const toKebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, '$1-$2').toLowerCase()

describe('map pin icons', () => {
  it('use the same lucide icon as the on-screen category icon', () => {
    for (const category of REPORT_CATEGORIES) {
      expect(PIN_ICON_DATA[category].name, category).toBe(toKebab(CATEGORY_ICONS[category].displayName ?? ''))
    }
  })

  it('build a decorative SVG without emojis', () => {
    const svg = iconSvg(PIN_ICON_DATA.fire)
    expect(svg).toMatch(/^<svg [^>]*aria-hidden="true"/)
    expect(svg).toContain('<path d="')
    expect(svg).not.toContain('key=')
  })

  it('cache one Leaflet icon per category and variant', () => {
    expect(pinIcon('fire', 'critical')).toBe(pinIcon('fire', 'critical'))
    expect(pinIcon('fire', 'critical')).not.toBe(pinIcon('fire', 'low'))
    expect(pinIcon('location', 'draft').options.className).toBe('map-pin map-pin--draft')
  })
})
