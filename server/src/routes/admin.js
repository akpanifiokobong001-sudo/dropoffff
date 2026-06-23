// Admin-only shipment control. Unlike the user-facing shipments router, these
// endpoints are NOT scoped to an owner — an admin can look up and control ANY
// shipment by its tracking code, in either direction along the timeline.
import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAdmin } from '../auth.js'
import { asyncHandler } from '../async-handler.js'
import { STAGES, serializeShipment, setProgress } from '../shipment-stages.js'

const router = Router()

// Helper to extract client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         'unknown'
}

// Helper to log admin progress updates
async function logAdminProgress(shipmentId, adminUserId, fromStage, toStage, stageIndex, changePayload, req) {
  const ip = getClientIP(req)
  const userAgent = req.headers['user-agent'] || ''
  
  await query(
    `INSERT INTO progress_logs (shipment_id, user_id, from_stage, to_stage, stage_index, change_payload, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [shipmentId, adminUserId, fromStage, toStage, stageIndex, JSON.stringify({ ...changePayload, admin: true }), ip, userAgent]
  )
}

// Attach the owner's email/name to a serialized shipment so the admin UI can
// show who booked it.
async function withOwner(row) {
  const shipment = await serializeShipment(row)
  let owner = null
  if (row.user_id != null) {
    const u = await queryOne('SELECT id, email, name FROM users WHERE id = $1', [row.user_id])
    if (u) owner = { id: u.id, email: u.email, name: u.name }
  }
  return { ...shipment, owner }
}

// GET /api/admin/stats — overview metrics for the admin dashboard: totals,
// a status breakdown, revenue, and recent activity counts.
router.get('/stats', requireAdmin, asyncHandler(async (_req, res) => {
  const totals = await queryOne(`
    SELECT
      (SELECT COUNT(*) FROM shipments)                              AS total_shipments,
      (SELECT COUNT(*) FROM users)                                  AS total_users,
      (SELECT COUNT(*) FROM shipments WHERE status = 'delivered')   AS delivered,
      (SELECT COUNT(*) FROM shipments WHERE status <> 'delivered')  AS in_transit,
      (SELECT COUNT(*) FROM shipments WHERE created_at > now() - interval '7 days') AS recent_shipments,
      (SELECT COALESCE(SUM(price), 0) FROM shipments)               AS revenue
  `)

  const byStatus = await query(
    'SELECT status, COUNT(*)::int AS count FROM shipments GROUP BY status ORDER BY count DESC',
  )

  return res.json({
    stats: {
      totalShipments: Number(totals.total_shipments),
      totalUsers: Number(totals.total_users),
      delivered: Number(totals.delivered),
      inTransit: Number(totals.in_transit),
      recentShipments: Number(totals.recent_shipments),
      revenue: Number(totals.revenue),
      byStatus: byStatus.map((r) => ({ status: r.status, count: r.count })),
    },
  })
}))

// GET /api/admin/shipments — every shipment, newest first.
router.get('/shipments', requireAdmin, asyncHandler(async (_req, res) => {
  const rows = await query('SELECT * FROM shipments ORDER BY id DESC')
  const shipments = await Promise.all(rows.map(withOwner))
  return res.json({ shipments })
}))

// GET /api/admin/shipments/:tracking — look up any shipment by tracking code
// (no owner restriction). 404 only if it genuinely doesn't exist.
router.get('/shipments/:tracking', requireAdmin, asyncHandler(async (req, res) => {
  const row = await queryOne(
    'SELECT * FROM shipments WHERE tracking_number = $1',
    [String(req.params.tracking).toUpperCase()],
  )
  if (!row) return res.status(404).json({ error: 'No shipment found for that tracking number' })
  return res.json({ shipment: await withOwner(row) })
}))

// PATCH /api/admin/shipments/:tracking/stage — set a shipment to ANY stage,
// forward or backward. Accepts { toIndex } or { toStage }.
router.patch('/shipments/:tracking/stage', requireAdmin, asyncHandler(async (req, res) => {
  const row = await queryOne(
    'SELECT * FROM shipments WHERE tracking_number = $1',
    [String(req.params.tracking).toUpperCase()],
  )
  if (!row) return res.status(404).json({ error: 'No shipment found for that tracking number' })

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
    return res.status(400).json({ error: 'Provide toStage or toIndex' })
  }

  // Get current stage before updating
  const countRow = await queryOne('SELECT COUNT(*) AS c FROM shipment_events WHERE shipment_id = $1 AND done = true', [row.id])
  const doneCount = Number(countRow.c)
  const currentIndex = Math.max(0, doneCount - 1)
  const fromStage = STAGES[currentIndex]?.key

  // No forward-only guard here: admins may move a shipment to any stage.
  await setProgress(row, target)

  // Log admin progress change
  const toStageKey = STAGES[target]?.key
  await logAdminProgress(row.id, req.user.id, fromStage, toStageKey, target, { toStage, toIndex }, req)

  const updated = await queryOne('SELECT * FROM shipments WHERE id = $1', [row.id])
  return res.json({ shipment: await withOwner(updated) })
}))

export default router
