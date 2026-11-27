/**
 * Client-side validation for the registration form. This only improves the
 * user experience; the database enforces the same rules (consent version,
 * barangay, display name length) in handle_new_user and table constraints.
 */
export interface RegistrationInput {
  displayName: string
  barangayId: string
  email: string
  password: string
  confirmPassword: string
  consent: boolean
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>

export const PASSWORD_MIN_LENGTH = 8

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {}
  const name = input.displayName.trim()

  if (name.length < 2 || name.length > 60) {
    errors.displayName = 'Enter a display name of 2 to 60 characters.'
  }
  if (!/^\d+$/.test(input.barangayId)) {
    errors.barangayId = 'Select your barangay.'
  }
  if (!EMAIL_PATTERN.test(input.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }
  if (input.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (input.confirmPassword !== input.password) {
    errors.confirmPassword = 'Passwords do not match.'
  }
  if (!input.consent) {
    errors.consent = 'You must agree to the privacy notice to register.'
  }
  return errors
}

export function hasErrors(errors: RegistrationErrors): boolean {
  return Object.keys(errors).length > 0
}
