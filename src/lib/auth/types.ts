export type Role = 'resident' | 'office_staff' | 'admin'

export type VerificationStatus = 'unverified' | 'pending' | 'approved' | 'rejected'

/** Columns of public.profiles that the client reads. */
export interface Profile {
  id: string
  role: Role
  display_name: string
  barangay_id: number | null
  office_id: number | null
  verification_status: VerificationStatus
}

export interface Barangay {
  id: number
  name: string
}

/** The area (route prefix) each role belongs to. */
const HOME_BY_ROLE: Record<Role, string> = {
  resident: '/app',
  office_staff: '/office',
  admin: '/admin',
}

export function homePathForRole(role: Role): string {
  return HOME_BY_ROLE[role]
}

/**
 * Returns true when `path` is inside the area of `role`, so a post-login
 * redirect back to a deep link never crosses into another role's area.
 */
export function isPathInRoleArea(path: string, role: Role): boolean {
  const home = homePathForRole(role)
  return path === home || path.startsWith(`${home}/`)
}
