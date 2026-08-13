// Receipt derivation for a booked shipment.
//
// The shipments table stores the final `price` but not the line-item breakdown,
// so we recompute it from the same inputs the server used (route, states,
// weight, service) via the shared pricing engine. Because src/lib/pricing.js is
// a port of server/src/pricing.js and the stored price came from that engine,
// the reconstructed lines add up to the stored total for any shipment booked at
// the current rates.
//
// If rates ever change, historical shipments would recompute to a different
// total. We therefore always display the STORED price as the amount due and
// surface a mismatch instead of silently showing stale lines — a receipt that
// disagrees with what was charged is worse than one without a breakdown.
import { estimatePrice, SERVICES, formatPrice } from './pricing.js'

// Receipt/invoice number derived from the tracking number, so it's stable
// across reloads and reprints without needing a new DB column.
export function receiptNumber(shipment) {
  const suffix = String(shipment?.trackingNumber || '').replace(/[^A-Z0-9]/gi, '').slice(-8).toUpperCase()
  const year = new Date(shipment?.createdAt || Date.now()).getUTCFullYear()
  return `DR-${year}-${suffix || 'PENDING'}`
}

export function formatReceiptDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatReceiptDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
}

const CENTS = (n) => Math.round(Number(n || 0) * 100)

/**
 * Builds the printable receipt view-model for a serialized shipment.
 * Returns { lines, total, storedTotal, reconciled, ... } where `total` is
 * always the stored (actually-charged) amount.
 */
export function buildReceipt(shipment) {
  if (!shipment) return null

  const currency = shipment.currency || 'USD'
  const storedTotal = Number(shipment.price || 0)

  const quote = estimatePrice({
    fromCode: shipment.from?.code,
    toCode: shipment.to?.code,
    fromState: shipment.from?.state || '',
    toState: shipment.to?.state || '',
    weightKg: Number(shipment.weightKg || 0),
    service: shipment.service,
  })

  const b = quote.breakdown
  const lines = [
    { key: 'base', label: 'Base handling & pickup', amount: b.base },
    { key: 'distance', label: 'Distance / zone charge', amount: b.distance },
    { key: 'weight', label: `Weight (${shipment.weightKg} kg)`, amount: b.weight },
    // Only shown when states are involved, matching stateSurcharge()'s 0 case.
    ...(b.interState > 0 ? [{ key: 'interState', label: 'Inter-state routing', amount: b.interState }] : []),
    { key: 'fees', label: 'Fuel surcharge & customs handling', amount: b.fees },
  ]

  // Compare in integer cents — the line items are each rounded to 2dp, so a
  // float sum can drift a cent from the stored total even when they agree.
  const lineSum = lines.reduce((sum, l) => sum + CENTS(l.amount), 0)
  const reconciled = Math.abs(lineSum - CENTS(storedTotal)) <= 1

  const serviceName = SERVICES[shipment.service]?.name || shipment.service || 'Standard'

  return {
    receiptNumber: receiptNumber(shipment),
    issuedAt: shipment.createdAt,
    trackingNumber: shipment.trackingNumber,
    serviceName,
    lines,
    // The authoritative amount is what was stored at booking time.
    total: storedTotal,
    currency,
    // False when the pricing engine no longer reproduces the stored total
    // (e.g. rates changed after booking) — the UI hides the breakdown then.
    reconciled,
    formattedTotal: formatPrice(storedTotal, currency),
  }
}
