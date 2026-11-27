import type { AlertInput } from './types'

/** UX validation; the alerts table constraints enforce the same rules. */
export function validateAlert(input: AlertInput): string | null {
  if (input.title.trim().length < 3) return 'Enter a title of at least 3 characters.'
  if (input.body.trim().length < 3) return 'Enter the message for residents.'
  if (input.scope === 'barangay' && input.targetBarangayIds.length === 0) return 'Select at least one barangay.'
  return null
}
