import { describe, expect, it } from 'vitest'
import { isRetryableError } from '../network'
import { MAX_PHOTO_BYTES, validatePhoto } from './photoValidation'

const blob = (size: number, type: string) => new Blob([new Uint8Array(size)], { type })

describe('validatePhoto (mirrors the storage bucket limits)', () => {
  it('accepts JPEG, PNG, and WebP up to 5 MB', () => {
    expect(validatePhoto(blob(1024, 'image/jpeg'))).toBeNull()
    expect(validatePhoto(blob(1024, 'image/png'))).toBeNull()
    expect(validatePhoto(blob(MAX_PHOTO_BYTES, 'image/webp'))).toBeNull()
  })

  it('rejects other formats (e.g., HEIC that the browser could not convert)', () => {
    expect(validatePhoto(blob(1024, 'image/heic'))).toMatch(/not supported/)
    expect(validatePhoto(blob(1024, 'application/pdf'))).toMatch(/not supported/)
  })

  it('rejects files larger than 5 MB and empty files', () => {
    expect(validatePhoto(blob(MAX_PHOTO_BYTES + 1, 'image/jpeg'))).toMatch(/larger than 5 MB/)
    expect(validatePhoto(blob(0, 'image/jpeg'))).toMatch(/empty/)
  })
})

describe('isRetryableError', () => {
  it('treats network failures as retryable and rule violations as final', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isRetryableError(new Error('Load failed'))).toBe(true)
    expect(isRetryableError(new Error('Too many reports in the last hour.'))).toBe(false)
    expect(isRetryableError(new Error('The location is outside the Municipality of Cuenca'))).toBe(false)
  })
})
