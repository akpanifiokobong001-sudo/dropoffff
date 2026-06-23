import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { estimatePrice } from '../pricing.js'
import { isValidCountry, COUNTRY_NAME } from '../countries.js'
import { hasStates, isValidState } from '../states.js'
import { requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'
import { STAGES, buildStages, buildPlaceFor, serializeShipment, setProgress } from '../shipment-stages.js'

const router = Router()

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars
function randChunk(n) {
  let s = ''
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)]
  return s
}
async function newTrackingNumber() {
  // e.g. DROP-7X4K-2291 — retry on the rare collision against the UNIQUE column.
  for (let attempt = 0; attempt < 6; attempt++) {
    const tn = `DROP-${randChunk(4)}-${randChunk(4)}`
    const exists = await queryOne('SELECT 1 FROM shipments WHERE tracking_number = $1', [tn])
    if (!exists) return tn
  }
  return `DROP-${Date.now().toString(36).toUpperCase()}`
}

// serializeShipment, STAGES, and setProgress now live in ../shipment-stages.js
// (shared with the admin router).

// "Lagos, Nigeria" when a state is set, otherwise just "Nigeria".
function placeName(state, countryName) {
  return state ? `${state}, ${countryName}` : countryName
}

// Validate an optional parcel photo. We accept a base64 data URL for a common
// raster image type (the frontend compresses to JPEG before upload). Returns
// the cleaned string, or throws an Error with a user-facing message.
const PHOTO_MAX_BYTES = 1_500_000 // ~1.5MB of data-URL text (~1.1MB decoded)
const PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/
function validatePhoto(photo) {
  if (photo == null || photo === '') return null
  if (typeof photo !== 'string') throw new Error('Photo must be a data URL string')
  if (photo.length > PHOTO_MAX_BYTES) throw new Error('Photo is too large (max ~1MB after compression)')
  if (!PHOTO_RE.test(photo)) throw new Error('Photo must be a JPEG, PNG, or WebP image')
  return photo
}

// POST /api/shipments — create a shipment. Auth required: every shipment is owned
// by the signed-in user who booked it.
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { fromCode, toCode, fromState = '', toState = '', weightKg, service = 'express', parcelType = 'box', sender = {}, recipient = {}, photo } = req.body || {}

  if (!isValidCountry(fromCode)) return res.status(400).json({ error: 'Invalid origin country code' })
  if (!isValidCountry(toCode)) return res.status(400).json({ error: 'Invalid destination country code' })

  // States are optional, but if given (or required by the country) they must be valid.
  if (fromState && !isValidState(fromCode, fromState)) return res.status(400).json({ error: 'Invalid origin state' })
  if (toState && !isValidState(toCode, toState)) return res.status(400).json({ error: 'Invalid destination state' })
  if (hasStates(fromCode) && !fromState) return res.status(400).json({ error: 'Origin state is required' })
  if (hasStates(toCode) && !toState) return res.status(400).json({ error: 'Destination state is required' })

  // A shipment is "domestic" only when it stays in the exact same place: same
  // country AND (where states apply) the same state. Different states in one
  // country is treated as an inter-state shipment with a full transit timeline.
  const domestic = fromCode === toCode && (fromState || '') === (toState || '')

  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0 || w > 1000) return res.status(400).json({ error: 'Weight must be a positive number (kg)' })

  let photoData
  try {
    photoData = validatePhoto(photo)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  const quote = estimatePrice({ fromCode, toCode, fromState, toState, weightKg: w, service })
  const tracking = await newTrackingNumber()

  const inserted = await queryOne(
    `INSERT INTO shipments
      (tracking_number, user_id, from_code, to_code, from_state, to_state, weight_kg, service, parcel_type, price, currency, eta_days, status, sender, recipient, photo)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'created', $13, $14, $15)
      RETURNING *`,
    [
      tracking,
      req.user.id,
      fromCode, toCode, fromState, toState, w, quote.service, parcelType,
      quote.price, quote.currency, quote.etaDays,
      JSON.stringify(sender || {}), JSON.stringify(recipient || {}),
      photoData,
    ],
  )

  // Seed the timeline: first stage done, rest pending. (A real system would
  // advance these over time.) Stage labels/places adapt for domestic shipments.
  // Place names include the state when one was chosen (e.g. "Lagos, Nigeria").
  const fromName = placeName(fromState, COUNTRY_NAME[fromCode] || fromCode)
  const toName = placeName(toState, COUNTRY_NAME[toCode] || toCode)
  const stages = buildStages(domestic)
  const placeFor = buildPlaceFor(domestic, fromName, toName)

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const done = i === 0
    await query(
      'INSERT INTO shipment_events (shipment_id, stage_key, label, detail, place, done, occurred_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [inserted.id, stage.key, stage.label, stage.detail, placeFor(i), done, done ? new Date().toISOString() : null],
    )
  }

  return res.status(201).json({ shipment: await serializeShipment(inserted) })
}))

// GET /api/shipments — the logged-in user's shipments (newest first).
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM shipments WHERE user_id = $1 ORDER BY id DESC', [req.user.id])
  const shipments = await Promise.all(rows.map(serializeShipment))
  return res.json({ shipments })
}))

// GET /api/shipments/:tracking — lookup by tracking number, restricted to the
// owner. Returns 404 (not 403) for shipments owned by someone else so we never
// leak the existence of another account's parcel.
router.get('/:tracking', requireAuth, asyncHandler(async (req, res) => {
  const row = await queryOne('SELECT * FROM shipments WHERE tracking_number = $1', [String(req.params.tracking).toUpperCase()])
  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: 'No shipment found for that tracking number' })
  }
  return res.json({ shipment: await serializeShipment(row) })
}))

// PATCH /api/shipments/:tracking/advance — move a shipment forward in its
// timeline. Owner-only (same privacy rule as the other endpoints).
//   - No body / {}            → advance by one stage.
//   - { toStage: 'customs' }  → jump to a named stage.
//   - { toIndex: 4 }          → jump to a 0-based stage index.
// Returns the updated shipment. 400 if already delivered or the target is invalid.
router.patch('/:tracking/advance', requireAuth, asyncHandler(async (req, res) => {
  const row = await queryOne('SELECT * FROM shipments WHERE tracking_number = $1', [String(req.params.tracking).toUpperCase()])
  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: 'No shipment found for that tracking number' })
  }

  const countRow = await queryOne('SELECT COUNT(*) AS c FROM shipment_events WHERE shipment_id = $1 AND done = true', [row.id])
  const doneCount = Number(countRow.c)
  const currentIndex = Math.max(0, doneCount - 1)

  const { toStage, toIndex } = req.body || {}
  let target
  if (toStage != null) {
    target = STAGES.findIndex((s) => s.key === String(toStage))
    if (target === -1) return res.status(400).json({ error: `Unknown stage "${toStage}"` })
  } else if (toIndex != null) {
    target = Number(toIndex)
    if (!Number.isInteger(target) || target < 0 || target >= STAGES.length) {
      return res.status(400).json({ error: `toIndex must be between 0 and ${STAGES.length - 1}` })
    }
  } else {
    target = currentIndex + 1
    if (target >= STAGES.length) {
      return res.status(400).json({ error: 'Shipment is already delivered' })
    }
  }

  // Don't allow moving a parcel backwards via this endpoint.
  if (target < currentIndex) {
    return res.status(400).json({ error: 'Cannot move a shipment to an earlier stage' })
  }

  await setProgress(row, target)

  const updated = await queryOne('SELECT * FROM shipments WHERE id = $1', [row.id])
  return res.json({ shipment: await serializeShipment(updated) })
}))

export default router
