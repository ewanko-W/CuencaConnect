import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from './types'

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn'

export interface AuthState {
  /** 'signedIn' is reported only after the profile fetch has finished. */
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  profileError: string | null
  /** False when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. */
  configured: boolean
  signOut: () => Promise<void>
  refreshProfile: () => void
}

export const signedOutState: AuthState = {
  status: 'signedOut',
  session: null,
  profile: null,
  profileError: null,
  configured: false,
  signOut: async () => {},
  refreshProfile: () => {},
}

export const AuthContext = createContext<AuthState>(signedOutState)

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
