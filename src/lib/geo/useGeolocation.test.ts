import { describe, expect, it } from 'vitest'
import { MAX_USABLE_ACCURACY_M, describeAccuracy, isUsableFix } from './useGeolocation'

describe('GPS accuracy helpers', () => {
  it('accepts fixes up to the usable accuracy and rejects approximate ones', () => {
    expect(isUsableFix({ lat: 13.9, lng: 121.05, accuracy: 15 })).toBe(true)
    expect(isUsableFix({ lat: 13.9, lng: 121.05, accuracy: MAX_USABLE_ACCURACY_M })).toBe(true)
    expect(isUsableFix({ lat: 13.9, lng: 121.05, accuracy: 50000 })).toBe(false)
    expect(isUsableFix({ lat: 13.9, lng: 121.05, accuracy: Number.NaN })).toBe(false)
    expect(isUsableFix(null)).toBe(false)
  })

  it('describes accuracy in meters or kilometers', () => {
    expect(describeAccuracy(820)).toBe('about 820 m')
    expect(describeAccuracy(50000)).toBe('about 50 km')
  })
})
