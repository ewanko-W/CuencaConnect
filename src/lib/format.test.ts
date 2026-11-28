import { describe, expect, it } from 'vitest'
import { telHref } from './directory/api'
import { formatRelative } from './format'
import { formatDistance } from './geo/cuenca'

describe('formatting helpers', () => {
  const now = new Date('2026-11-27T12:00:00Z')

  it('formats relative times', () => {
    expect(formatRelative('2026-11-27T11:59:30Z', now)).toBe('just now')
    expect(formatRelative('2026-11-27T11:55:00Z', now)).toBe('5 min ago')
    expect(formatRelative('2026-11-27T09:00:00Z', now)).toBe('3 h ago')
    expect(formatRelative('2026-11-25T12:00:00Z', now)).toBe('2 d ago')
  })

  it('formats distances', () => {
    expect(formatDistance(234)).toBe('230 m')
    expect(formatDistance(2500)).toBe('2.5 km')
  })

  it('builds tel: links from formatted hotlines', () => {
    expect(telHref('(043) 000-0001')).toBe('tel:0430000001')
    expect(telHref('+63 917 000 0000')).toBe('tel:+639170000000')
  })
})
