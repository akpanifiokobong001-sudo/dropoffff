import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { estimatePrice } from '../pricing.js'
import { isValidCountry, COUNTRY_NAME } from '../countries.js'
import { hasStates, isValidState } from '../states.js'
import { requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'
import { buildStages, buildPlaceFor, serializeShipment } from '../shipment-stages.js'

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

// Sender/recipient contact fields. All four are required and capped to keep the
// JSON small. Returns a cleaned object, or throws an Error with a user-facing
// message naming which party (sender/recipient) is incomplete.
const CONTACT_FIELDS = ['name', 'address', 'city', 'phone']
const CONTACT_MAX = 200
function cleanContact(raw, who) {
  const c = raw && typeof raw === 'object' ? raw : {}
  const out = {}
  for (const field of CONTACT_FIELDS) {
    const v = String(c[field] ?? '').trim()
    if (!v) throw new Error(`${who} ${field} is required`)
    if (v.length > CONTACT_MAX) throw new Error(`${who} ${field} is too long`)
    out[field] = v
  }
  return out
}

// Helper to extract client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         'unknown'
}

// Helper to log booking attempts
async function logBooking(userId, shipmentId, payload, status, errorMessage = null, req) {
  const ip = getClientIP(req)
  const userAgent = req.headers['user-agent'] || ''
  
  await query(
    `INSERT INTO booking_logs (user_id, shipment_id, payload, status, error_message, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, shipmentId || null, JSON.stringify(payload), status, errorMessage || null, ip, userAgent]
  )
}

// Helper to log progress updates
async function logProgress(shipmentId, userId, fromStage, toStage, stageIndex, changePayload, req) {
  const ip = getClientIP(req)
  const userAgent = req.headers['user-agent'] || ''
  
  await query(
    `INSERT INTO progress_logs (shipment_id, user_id, from_stage, to_stage, stage_index, change_payload, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [shipmentId, userId, fromStage, toStage, stageIndex, JSON.stringify(changePayload || {}), ip, userAgent]
  )
}

// POST /api/shipments — create a shipment. Auth required: every shipment is owned
// by the signed-in user who booked it.
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { fromCode, toCode, fromState = '', toState = '', weightKg, service = 'express', parcelType = 'box', sender = {}, recipient = {}, photo } = req.body || {}
  const bookingPayload = { fromCode, toCode, fromState, toState, weightKg, service, parcelType, timestamp: new Date().toISOString() }

  if (!isValidCountry(fromCode)) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_origin', 'Invalid origin country code', req)
    return res.status(400).json({ error: 'Invalid origin country code' })
  }
  if (!isValidCountry(toCode)) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_destination', 'Invalid destination country code', req)
    return res.status(400).json({ error: 'Invalid destination country code' })
  }

  // States are optional, but if given (or required by the country) they must be valid.
  if (fromState && !isValidState(fromCode, fromState)) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_origin_state', 'Invalid origin state', req)
    return res.status(400).json({ error: 'Invalid origin state' })
  }
  if (toState && !isValidState(toCode, toState)) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_destination_state', 'Invalid destination state', req)
    return res.status(400).json({ error: 'Invalid destination state' })
  }
  if (hasStates(fromCode) && !fromState) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_origin_state_required', 'Origin state is required', req)
    return res.status(400).json({ error: 'Origin state is required' })
  }
  if (hasStates(toCode) && !toState) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_destination_state_required', 'Destination state is required', req)
    return res.status(400).json({ error: 'Destination state is required' })
  }

  // A shipment is "domestic" only when it stays in the exact same place: same
  // country AND (where states apply) the same state. Different states in one
  // country is treated as an inter-state shipment with a full transit timeline.
  const domestic = fromCode === toCode && (fromState || '') === (toState || '')

  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0 || w > 1000) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_weight', 'Weight must be a positive number (kg)', req)
    return res.status(400).json({ error: 'Weight must be a positive number (kg)' })
  }

  let photoData
  try {
    photoData = validatePhoto(photo)
  } catch (err) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_photo', err.message, req)
    return res.status(400).json({ error: err.message })
  }

  // Sender + recipient contact details are required for pickup/delivery.
  let senderClean, recipientClean
  try {
    senderClean = cleanContact(sender, 'Sender')
    recipientClean = cleanContact(recipient, 'Recipient')
  } catch (err) {
    await logBooking(req.user.id, null, bookingPayload, 'booking_failed_invalid_contact', err.message, req)
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
      JSON.stringify(senderClean), JSON.stringify(recipientClean),
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
    
    // Log the initial 'created' stage
    if (done) {
      await logProgress(inserted.id, req.user.id, null, stage.key, i, { initial: true, domestic }, req)
    }
  }

  // Log successful booking
  await logBooking(req.user.id, inserted.id, { ...bookingPayload, tracking, price: quote.price }, 'booking_success', null, req)
  
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

// NOTE: Customers can no longer change a shipment's status. The parcel timeline
// is operational state owned by DropOff staff, so advancing/moving a shipment is
// admin-only — see PATCH /api/admin/shipments/:tracking/stage (routes/admin.js).
// The former owner-facing PATCH /:tracking/advance endpoint was removed.

export default router
