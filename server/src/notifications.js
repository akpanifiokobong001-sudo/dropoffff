// In-app notification helper. Creates a single notification row for a user.
// Like the login/booking loggers, this must never break the request that
// triggered it: any failure is logged and swallowed, so a notification insert
// problem can't fail a booking or a stage change.
import { query } from './db.js'

export async function notify(userId, { type, title, body = '', link = null } = {}) {
  // Skip silently when there's no owner to notify (e.g. a shipment whose user
  // was deleted, leaving user_id NULL).
  if (userId == null) return
  try {
    await query(
      'INSERT INTO notifications (user_id, type, title, body, link) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, title, body, link],
    )
  } catch (err) {
    console.error('[notify] failed to create notification:', err.message)
  }
}
