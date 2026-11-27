import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { isRetryableError } from '../network'
import { fetchProfile } from './api'
import { useOnlineStatus } from '../../pwa/useOnlineStatus'
import { clearCachedProfile, loadCachedProfile, saveCachedProfile } from './profileCache'
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
  const online = useOnlineStatus()
  // Profile saved on this device; used at once when starting offline instead
  // of waiting for the network requests to time out.
  const cachedProfile = useMemo(() => (userId ? loadCachedProfile(userId) : null), [userId])

  useEffect(() => {
    if (!client || !userId) return
    let active = true
    fetchProfile(client, userId)
      .then((profile) => {
        saveCachedProfile(profile)
        if (active) setProfileResult({ userId, profile, error: null })
      })
      .catch((err: unknown) => {
        if (!active) return
        // Offline start of the installed app: use the profile saved on this device.
        const cached = isRetryableError(err) ? loadCachedProfile(userId) : null
        setProfileResult({
          userId,
          profile: cached,
          error: cached ? null : err instanceof Error ? err.message : 'Could not load your profile.',
        })
      })
    return () => {
      active = false
    }
  }, [client, userId, reloadKey])

  // Refresh the profile (e.g., a new verification status) when the connection returns.
  useEffect(() => {
    const onOnline = () => setReloadKey((k) => k + 1)
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const signOut = useCallback(async () => {
    clearCachedProfile()
    if (client) await client.auth.signOut()
  }, [client])

  const refreshProfile = useCallback(() => setReloadKey((k) => k + 1), [])

  const value = useMemo<AuthState>(() => {
    const fetched = profileResult && profileResult.userId === userId ? profileResult : null
    const current =
      fetched ?? (!online && cachedProfile && userId ? { userId, profile: cachedProfile, error: null } : null)
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
  }, [cachedProfile, client, online, profileResult, refreshProfile, session, sessionLoaded, signOut, userId])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
