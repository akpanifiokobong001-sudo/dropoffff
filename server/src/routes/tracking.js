import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { COUNTRY_NAME } from '../countries.js'
import { requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'

const router = Router()

const TOTAL_STAGES = 8

// GET /api/tracking/:tracking — timeline lookup, restricted to the shipment's owner.
// Returns 404 for unknown or non-owned numbers so others' parcels stay private.
router.get('/:tracking', requireAuth, asyncHandler(async (req, res) => {
  const row = await queryOne(
    'SELECT * FROM shipments WHERE tracking_number = $1',
    [String(req.params.tracking).toUpperCase()],
  )

  if (!row || row.user_id !== req.user.id) {
    return res.status(404).json({ error: 'No shipment found for that tracking number' })
  }

  const events = await query(
    'SELECT stage_key, label, detail, place, done FROM shipment_events WHERE shipment_id = $1 ORDER BY id',
    [row.id],
  )

  const currentIndex = Math.max(0, events.filter((e) => e.done).length - 1)

  return res.json({
    tracking: {
      trackingNumber: row.tracking_number,
      status: row.status,
      delivered: row.status === 'delivered',
      photo: row.photo || null,
      origin: events[0]?.place || COUNTRY_NAME[row.from_code] || row.from_code,
      destination: events[events.length - 1]?.place || COUNTRY_NAME[row.to_code] || row.to_code,
      currentIndex,
      progress: Math.round(((currentIndex + 1) / TOTAL_STAGES) * 100),
      timeline: events.map((e, i) => ({
        key: e.stage_key,
        label: e.label,
        detail: e.detail,
        place: e.place,
        done: !!e.done,
        current: i === currentIndex,
      })),
    },
  })
}))

export default router
