// User-facing notification feed. Every endpoint requires auth and is scoped to
// the signed-in user — a user can only see and modify their own notifications.
import { Router } from 'express'
import { query, queryOne } from '../db.js'
import { requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'

const router = Router()

// Shape a DB row for the client (camelCase + ISO timestamp).
function serialize(row) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    link: row.link,
    read: !!row.read,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  }
}

// GET /api/notifications — the 50 most recent, newest first, plus the unread count.
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const rows = await query(
    'SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 50',
    [req.user.id],
  )
  const countRow = await queryOne(
    'SELECT COUNT(*)::int AS c FROM notifications WHERE user_id = $1 AND read = false',
    [req.user.id],
  )
  return res.json({ notifications: rows.map(serialize), unreadCount: Number(countRow.c) })
}))

// PATCH /api/notifications/:id/read — mark one notification read (owner only).
router.patch('/:id/read', requireAuth, asyncHandler(async (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid notification id' })
  const updated = await queryOne(
    'UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2 RETURNING *',
    [id, req.user.id],
  )
  if (!updated) return res.status(404).json({ error: 'Notification not found' })
  return res.json({ notification: serialize(updated) })
}))

// POST /api/notifications/read-all — mark all of the user's notifications read.
router.post('/read-all', requireAuth, asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET read = true WHERE user_id = $1 AND read = false', [req.user.id])
  return res.json({ ok: true })
}))

export default router
