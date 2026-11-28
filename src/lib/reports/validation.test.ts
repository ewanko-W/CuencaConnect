import { describe, expect, it } from 'vitest'
import { CUENCA_CENTER, isWithinCuenca } from '../geo/cuenca'
import { validateReportForm, type ReportFormInput } from './validation'

const valid: ReportFormInput = {
  category: 'flood',
  description: 'Flooded street near the plaza.',
  location: CUENCA_CENTER,
  photoCount: 1,
}

describe('validateReportForm', () => {
  it('accepts a complete report', () => {
    expect(validateReportForm(valid)).toEqual({})
  })

  it('requires a category, a description of 10+ characters, and a location', () => {
    expect(Object.keys(validateReportForm({ category: null, description: 'short', location: null, photoCount: 0 })).sort()).toEqual(
      ['category', 'description', 'location'],
    )
  })

  it('rejects a pin outside Cuenca', () => {
    expect(validateReportForm({ ...valid, location: { lat: 14.5995, lng: 120.9842 } }).location).toMatch(/outside Cuenca/)
  })

  it('allows at most three photos', () => {
    expect(validateReportForm({ ...valid, photoCount: 4 }).photos).toBeDefined()
  })
})

describe('isWithinCuenca', () => {
  it('matches the database bounding box', () => {
    expect(isWithinCuenca(CUENCA_CENTER)).toBe(true)
    expect(isWithinCuenca({ lat: 13.84, lng: 120.98 })).toBe(true)
    expect(isWithinCuenca({ lat: 13.83, lng: 121.05 })).toBe(false)
    expect(isWithinCuenca({ lat: 13.91, lng: 121.13 })).toBe(false)
  })
})
