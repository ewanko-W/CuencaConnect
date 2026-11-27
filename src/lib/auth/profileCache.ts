import type { Profile } from './types'

/**
 * Keeps the signed-in user's profile on the device so the installed app can
 * open without a connection. Only the fields the UI needs are stored (no
 * email or contact data), and the cache is cleared on sign-out. The role
 * here only drives the UI; Row Level Security still decides data access.
 */
const KEY = 'cc.profile.v1'

export function saveCachedProfile(profile: Profile): void {
  try {
    const { id, role, display_name, barangay_id, office_id, verification_status } = profile
    localStorage.setItem(KEY, JSON.stringify({ id, role, display_name, barangay_id, office_id, verification_status }))
  } catch {
    // Storage may be unavailable (private mode); the app still works online.
  }
}

export function loadCachedProfile(userId: string): Profile | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const profile = JSON.parse(raw) as Profile
    return profile.id === userId ? profile : null
  } catch {
    return null
  }
}

export function clearCachedProfile(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
