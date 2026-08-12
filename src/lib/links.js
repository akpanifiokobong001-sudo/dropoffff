// Absolute, shareable links into the app. QR codes and copied links must carry
// the origin — a bare "/track?number=..." is useless once it leaves the browser.

export function trackUrl(trackingNumber) {
  const path = `/track?number=${encodeURIComponent(trackingNumber)}`
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}
