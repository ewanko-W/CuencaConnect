import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Reads Supabase connection settings from Vite environment variables.
 * Returns null when they are missing so the UI can show a setup hint
 * instead of crashing (for example, before .env.local exists).
 */
export function readSupabaseConfig(
  env: Record<string, string | undefined> = import.meta.env,
): { url: string; anonKey: string } | null {
  const url = env.VITE_SUPABASE_URL?.trim()
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) return null
  return { url, anonKey }
}

const config = readSupabaseConfig()

/** Shared browser client. Access control is enforced by RLS in Postgres. */
export const supabase: SupabaseClient | null = config
  ? createClient(config.url, config.anonKey)
  : null
