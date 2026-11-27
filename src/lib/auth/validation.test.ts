import { describe, expect, it } from 'vitest'
import { hasErrors, validateRegistration, type RegistrationInput } from './validation'

const valid: RegistrationInput = {
  displayName: 'Maria Santos',
  barangayId: '6',
  email: 'maria@example.test',
  password: 'longenough',
  confirmPassword: 'longenough',
  consent: true,
}

describe('validateRegistration', () => {
  it('accepts a complete registration', () => {
    expect(hasErrors(validateRegistration(valid))).toBe(false)
  })

  it('requires consent to the privacy notice', () => {
    expect(validateRegistration({ ...valid, consent: false }).consent).toMatch(/privacy notice/i)
  })

  it('requires a barangay', () => {
    expect(validateRegistration({ ...valid, barangayId: '' }).barangayId).toBeDefined()
  })

  it('checks display name length after trimming', () => {
    expect(validateRegistration({ ...valid, displayName: ' a ' }).displayName).toBeDefined()
    expect(validateRegistration({ ...valid, displayName: 'x'.repeat(61) }).displayName).toBeDefined()
  })

  it('checks email format, password length, and confirmation', () => {
    const errors = validateRegistration({ ...valid, email: 'not-an-email', password: 'short', confirmPassword: 'other' })
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'password'])
  })
})
