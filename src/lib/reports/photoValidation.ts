/** Must match the report-media bucket and report_media table limits. */
export const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024

/** Returns an error message, or null when the (already prepared) photo can be uploaded. */
export function validatePhoto(photo: Blob): string | null {
  if (!(ALLOWED_PHOTO_TYPES as readonly string[]).includes(photo.type)) {
    return 'This photo format is not supported. Please take the photo again or choose a JPEG or PNG image.'
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return 'This photo is larger than 5 MB. Please take it again at a lower resolution.'
  }
  if (photo.size === 0) return 'This photo is empty.'
  return null
}
