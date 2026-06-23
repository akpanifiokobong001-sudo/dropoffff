// Shared shipment timeline logic, used by both the user-facing shipments router
// and the admin router. Keeping STAGES, the per-shipment stage/place builders,
// setProgress, and serializeShipment in one place avoids duplication.
import { query } from './db.js'
import { COUNTRY_NAME } from './countries.js'

// The canonical timeline stages (mirrors the frontend's tracking stages). The
// `created` stage is index 0 and `delivered` is the last; there are 8 stages.
export const STAGES = [
  { key: 'created', label: 'Label created', detail: 'Shipment registered and label generated' },
  { key: 'pickup', label: 'Picked up', detail: 'Collected from sender' },
  { key: 'origin', label: 'At origin facility', detail: 'Processed at origin sorting hub' },
  { key: 'transit', label: 'In transit', detail: 'On the move toward destination country' },
  { key: 'customs', label: 'Customs clearance', detail: 'Clearing international customs' },
  { key: 'destination', label: 'At destination facility', detail: 'Arrived at local delivery hub' },
  { key: 'out', label: 'Out for delivery', detail: 'With courier for final delivery' },
  { key: 'delivered', label: 'Delivered', detail: 'Delivered to recipient' },
]

// Build the per-shipment stage list. International shipments use STAGES as-is.
// Domestic shipments (same origin/destination country) have no customs step and
// shouldn't reference "destination country", so we relabel those two stages.
// The stage keys stay identical (index alignment with the frontend), only the
// human-facing label/detail change — and these are stored per shipment, so the
// tracking/serialize code needs no special-casing.
export function buildStages(domestic) {
  if (!domestic) return STAGES
  return STAGES.map((s) => {
    if (s.key === 'transit') return { ...s, detail: 'On the move toward the destination' }
    if (s.key === 'customs') return { ...s, label: 'In transit', detail: 'Moving between regional facilities' }
    return s
  })
}

// Build the place-for-stage function. Early stages happen at origin, late ones
// at destination; the middle hub is "International hub" for cross-border and
// "Regional hub" for domestic shipments.
export function buildPlaceFor(domestic, fromName, toName) {
  const hub = domestic ? 'Regional hub' : 'International hub'
  return (i) => (i <= 2 ? fromName : i >= 5 ? toName : hub)
}

// Serialize a shipment row + its events into the shape the frontend expects.
export async function serializeShipment(row) {
  const events = await query(
    'SELECT stage_key, label, detail, place, done, occurred_at FROM shipment_events WHERE shipment_id = $1 ORDER BY id',
    [row.id],
  )

  const currentIndex = Math.max(0, events.filter((e) => e.done).length - 1)
  const delivered = row.status === 'delivered'

  return {
    trackingNumber: row.tracking_number,
    status: row.status,
    from: { code: row.from_code, state: row.from_state || '', name: withState(row.from_state, COUNTRY_NAME[row.from_code] || row.from_code) },
    to: { code: row.to_code, state: row.to_state || '', name: withState(row.to_state, COUNTRY_NAME[row.to_code] || row.to_code) },
    origin: events[0]?.place || COUNTRY_NAME[row.from_code] || row.from_code,
    destination: events[events.length - 1]?.place || COUNTRY_NAME[row.to_code] || row.to_code,
    weightKg: row.weight_kg,
    service: row.service,
    parcelType: row.parcel_type,
    price: row.price,
    currency: row.currency,
    etaDays: row.eta_days,
    delivered,
    currentIndex,
    progress: Math.round(((currentIndex + 1) / STAGES.length) * 100),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    photo: row.photo || null,
    sender: safeJson(row.sender),
    recipient: safeJson(row.recipient),
    timeline: events.map((e, i) => ({
      key: e.stage_key,
      label: e.label,
      detail: e.detail,
      place: e.place,
      done: !!e.done,
      current: i === currentIndex,
    })),
  }
}

function safeJson(s) {
  try { return JSON.parse(s || '{}') } catch { return {} }
}

// "Lagos, Nigeria" when a state is set, otherwise just the country name.
function withState(state, countryName) {
  return state ? `${state}, ${countryName}` : countryName
}

// Set a shipment's timeline so stages 0..targetIndex are done (and the rest
// pending), then update the shipment status to the target stage. Newly-completed
// stages get a timestamp; previously-done ones keep theirs. Works in both
// directions (used by the admin "set to any stage" control). Idempotent.
export async function setProgress(shipment, targetIndex) {
  const events = await query(
    'SELECT id, stage_key, occurred_at FROM shipment_events WHERE shipment_id = $1 ORDER BY id',
    [shipment.id],
  )

  const now = new Date().toISOString()
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    if (i <= targetIndex) {
      await query('UPDATE shipment_events SET done = $1, occurred_at = $2 WHERE id = $3', [true, e.occurred_at || now, e.id])
    } else {
      await query('UPDATE shipment_events SET done = $1, occurred_at = $2 WHERE id = $3', [false, null, e.id])
    }
  }

  await query('UPDATE shipments SET status = $1 WHERE id = $2', [STAGES[targetIndex].key, shipment.id])
}
