// Client-side image compression for parcel photos.
//
// The shipments API stores the photo as a base64 JPEG data URL inside the JSON
// body (no multipart/file endpoint), so we downscale + re-encode in the browser
// to keep it well under the server's size cap. A phone photo (several MB) comes
// out as a ~100–300KB JPEG at 1280px on the long edge.

export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const MAX_INPUT_BYTES = 12 * 1024 * 1024 // reject absurdly large source files early

const MAX_EDGE = 1280 // longest side, in px
const QUALITY = 0.8 // JPEG quality

// Compress a File/Blob to a JPEG data URL. Resolves to a string, or rejects with
// an Error whose message is safe to show the user.
export function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file selected'))
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return reject(new Error('Please choose a JPEG, PNG, or WebP image'))
    }
    if (file.size > MAX_INPUT_BYTES) {
      return reject(new Error('That image is too large. Please pick one under 12MB'))
    }

    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const { width, height } = img
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
        const w = Math.max(1, Math.round(width * scale))
        const h = Math.max(1, Math.round(height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Could not process the image in this browser'))
        ctx.drawImage(img, 0, 0, w, h)

        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY)
        if (!dataUrl || !dataUrl.startsWith('data:image/jpeg')) {
          return reject(new Error('Could not process the image. Please try another'))
        }
        resolve(dataUrl)
      } catch {
        reject(new Error('Could not process the image. Please try another'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That file could not be read as an image'))
    }

    img.src = url
  })
}
