import { useMemo } from 'react'
import { qrMatrix } from '../lib/qr.js'

// Renders a QR code as inline SVG from the dependency-free encoder in lib/qr.js.
// Always drawn dark-on-white regardless of theme — scanners need the contrast,
// and an inverted code fails on most phone cameras.
export default function QRCode({ value, size = 160, ecc = 'M', quietZone = 4, className = '', title }) {
  const matrix = useMemo(() => {
    if (!value) return null
    try {
      return qrMatrix(value, { ecc })
    } catch {
      // Too long for versions 1-10 — the caller still gets a usable page.
      return null
    }
  }, [value, ecc])

  if (!matrix) return null

  const modules = matrix.length
  const span = modules + quietZone * 2

  // One path for every dark module, emitted as a single `d` string so the SVG
  // stays small enough to inline without hurting render time.
  const path = matrix
    .flatMap((row, r) =>
      row.map((dark, c) => (dark ? `M${c + quietZone} ${r + quietZone}h1v1h-1z` : null)).filter(Boolean),
    )
    .join('')

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${span} ${span}`}
      shapeRendering="crispEdges"
      className={className}
      role="img"
      aria-label={title || `QR code for ${value}`}
    >
      <rect width={span} height={span} fill="#fff" />
      <path d={path} fill="#0B1020" />
    </svg>
  )
}
