import { describe, expect, it } from 'vitest'
import { CONSENT_VERSION, friendlyAuthError } from './api'

describe('auth api helpers', () => {
  it('uses the consent version defined in the database migration', () => {
    // Must match public.current_consent_version() in
    // supabase/migrations/20261127000100_profiles_and_roles.sql
    expect(CONSENT_VERSION).toBe('2026-11-v1')
  })

  it('maps database sign-up failures to a helpful message', () => {
    expect(friendlyAuthError('Database error saving new user')).toMatch(/privacy notice/i)
  })

  it('maps invalid credentials', () => {
    expect(friendlyAuthError('Invalid login credentials')).toBe('Incorrect email or password.')
  })

  it('passes other messages through', () => {
    expect(friendlyAuthError('User already registered')).toBe('User already registered')
  })
})
