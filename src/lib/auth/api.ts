import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import type { Barangay, Profile } from './types'

/** Must equal public.current_consent_version() in the database. */
export const CONSENT_VERSION = '2026-11-v2'

const PROFILE_COLUMNS = 'id, role, display_name, barangay_id, office_id, verification_status'

function requireClient(client: SupabaseClient | null = supabase): SupabaseClient {
  if (!client) {
    throw new Error('Supabase is not configured. Copy .env.example to .env.local and set the values.')
  }
  return client
}

export async function fetchProfile(client: SupabaseClient, userId: string): Promise<Profile> {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export async function fetchBarangays(): Promise<Barangay[]> {
  const { data, error } = await requireClient().from('barangays').select('id, name').order('id')
  if (error) throw new Error(error.message)
  return data as Barangay[]
}

export interface SignUpParams {
  email: string
  password: string
  displayName: string
  barangayId: number
}

/**
 * Registers a resident. The role is never sent: the database always creates
 * a resident. Consent is sent as metadata and checked by handle_new_user.
 * Returns whether the user must confirm their email before signing in.
 */
export async function signUpResident(params: SignUpParams): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await requireClient().auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: {
        display_name: params.displayName.trim(),
        barangay_id: String(params.barangayId),
        consent_given: 'true',
        consent_version: CONSENT_VERSION,
      },
    },
  })
  if (error) throw new Error(friendlyAuthError(error.message))
  return { needsEmailConfirmation: data.session === null }
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
  const { error } = await requireClient().auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new Error(friendlyAuthError(error.message))
}

export function friendlyAuthError(message: string): string {
  if (/database error saving new user/i.test(message)) {
    return 'Registration was not accepted. Check that you selected a barangay and agreed to the privacy notice.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'Incorrect email or password.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address first, then sign in.'
  }
  return message
}
