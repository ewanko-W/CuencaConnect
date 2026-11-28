import { isWithinCuenca, type LatLng } from '../geo/cuenca'
import type { ReportCategory } from './types'

export const DESCRIPTION_MIN = 10
export const DESCRIPTION_MAX = 1000
export const MAX_PHOTOS = 3

export interface ReportFormInput {
  category: ReportCategory | null
  description: string
  location: LatLng | null
  photoCount: number
}

export type ReportFormErrors = Partial<Record<'category' | 'description' | 'location' | 'photos', string>>

/** UX validation; submit_report and table constraints enforce the same rules. */
export function validateReportForm(input: ReportFormInput): ReportFormErrors {
  const errors: ReportFormErrors = {}
  if (!input.category) errors.category = 'Choose what kind of incident this is.'

  const length = input.description.trim().length
  if (length < DESCRIPTION_MIN) {
    errors.description = `Describe what happened in at least ${DESCRIPTION_MIN} characters.`
  } else if (length > DESCRIPTION_MAX) {
    errors.description = `Keep the description under ${DESCRIPTION_MAX} characters.`
  }

  if (!input.location) {
    errors.location = 'Set the location of the incident on the map.'
  } else if (!isWithinCuenca(input.location)) {
    errors.location = 'The pin is outside Cuenca. Drag it to where the incident is.'
  }

  if (input.photoCount > MAX_PHOTOS) errors.photos = `Attach at most ${MAX_PHOTOS} photos.`
  return errors
}
