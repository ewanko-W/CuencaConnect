import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { fetchProfile } from './api'
import { AuthContext, type AuthState } from './AuthContext'
import type { Profile } from './types'

interface ProfileResult {
  userId: string
  profile: Profile | null
  error: string | null
}

export function AuthProvider({
  children,
  client = supabase,
}: {
  children: ReactNode
  client?: SupabaseClient | null
}) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoaded, setSessionLoaded] = useState(client === null)
  const [profileResult, setProfileResult] = useState<ProfileResult | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!client) return
    let active = true
    void client.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoaded(true)
    })
    // Keep this callback synchronous; Supabase warns against awaiting
    // other client calls inside onAuthStateChange.
    const { data } = client.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionLoaded(true)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [client])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!client || !userId) return
    let active = true
    fetchProfile(client, userId)
      .then((profile) => {
        if (active) setProfileResult({ userId, profile, error: null })
      })
      .catch((err: unknown) => {
        if (active) {
          setProfileResult({
            userId,
            profile: null,
            error: err instanceof Error ? err.message : 'Could not load your profile.',
          })
        }
      })
    return () => {
      active = false
    }
  }, [client, userId, reloadKey])

  const signOut = useCallback(async () => {
    if (client) await client.auth.signOut()
  }, [client])

  const refreshProfile = useCallback(() => setReloadKey((k) => k + 1), [])

  const value = useMemo<AuthState>(() => {
    const current = profileResult && profileResult.userId === userId ? profileResult : null
    let status: AuthState['status']
    if (!sessionLoaded) status = 'loading'
    else if (!session) status = 'signedOut'
    else if (!current) status = 'loading'
    else status = 'signedIn'

    return {
      status,
      session,
      profile: status === 'signedIn' ? (current?.profile ?? null) : null,
      profileError: status === 'signedIn' ? (current?.error ?? null) : null,
      configured: client !== null,
      signOut,
      refreshProfile,
    }
  }, [client, profileResult, refreshProfile, session, sessionLoaded, signOut, userId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
