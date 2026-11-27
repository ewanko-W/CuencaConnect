export const MAX_IMAGE_DIMENSION = 1600
export const JPEG_QUALITY = 0.8

/**
 * Prepares a camera photo for upload: scales it down to save mobile data and
 * re-encodes it as JPEG. Re-encoding through a canvas drops EXIF metadata,
 * including the GPS coordinates cameras embed (Data Privacy Act: collect
 * only what is needed). Falls back to the original file if the browser
 * lacks createImageBitmap/canvas support.
 */
export async function prepareImage(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    return blob ?? file
  } catch {
    return file
  }
}
