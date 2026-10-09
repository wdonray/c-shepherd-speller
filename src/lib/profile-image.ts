/**
 * Client-side profile photo processing.
 *
 * Selected images are resized on a canvas (max 256px on the long edge) and
 * exported as a JPEG data URL small enough to store on the user record in
 * DynamoDB (items are capped at 400KB; we stay far under that).
 */

export const PROFILE_IMAGE_MAX_FILE_BYTES = 5 * 1024 * 1024
export const PROFILE_IMAGE_MAX_DIMENSION = 256
export const PROFILE_IMAGE_MAX_DATA_URL_LENGTH = 100 * 1024
export const PROFILE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'] as const

const QUALITY_STEPS = [0.82, 0.7, 0.6]

function loadImage(objectUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the image file.'))
    img.src = objectUrl
  })
}

/**
 * Validate and resize an image file for use as a profile photo.
 * Resolves to a JPEG data URL, or rejects with a user-facing error message.
 */
export async function processProfileImage(file: File): Promise<string> {
  if (!PROFILE_IMAGE_MIME_TYPES.includes(file.type as (typeof PROFILE_IMAGE_MIME_TYPES)[number])) {
    throw new Error('Please choose a JPEG, PNG, WebP, or HEIC image.')
  }
  if (file.size > PROFILE_IMAGE_MAX_FILE_BYTES) {
    throw new Error('Please choose an image smaller than 5MB.')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const img = await loadImage(objectUrl)
    const scale = Math.min(1, PROFILE_IMAGE_MAX_DIMENSION / Math.max(img.width, img.height))
    const width = Math.max(1, Math.round(img.width * scale))
    const height = Math.max(1, Math.round(img.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not read the image file.')
    ctx.drawImage(img, 0, 0, width, height)

    for (const quality of QUALITY_STEPS) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= PROFILE_IMAGE_MAX_DATA_URL_LENGTH) return dataUrl
    }
    throw new Error('That image is too detailed to shrink down. Please try a smaller one.')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
