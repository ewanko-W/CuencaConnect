import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabaseClient'

describe('readSupabaseConfig', () => {
  it('returns null when variables are missing', () => {
    expect(readSupabaseConfig({})).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBeNull()
  })

  it('returns null for blank values', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: ' ' })).toBeNull()
  })

  it('returns trimmed values when both are present', () => {
    expect(
      readSupabaseConfig({
        VITE_SUPABASE_URL: ' http://127.0.0.1:54321 ',
        VITE_SUPABASE_ANON_KEY: ' test-anon-key ',
      }),
    ).toEqual({ url: 'http://127.0.0.1:54321', anonKey: 'test-anon-key' })
  })
})
