import { Router } from 'express'
import { queryOne, query } from '../db.js'
import { hashPassword, verifyPassword, signToken, publicUser, requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Helper to extract client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim() ||
         req.socket.remoteAddress ||
         'unknown'
}

// Helper to log login attempts
async function logLoginAttempt(email, userId, payload, status, req) {
  try {
    const ip = getClientIP(req)
    const userAgent = req.headers['user-agent'] || ''
    
    await query(
      `INSERT INTO login_logs (email, user_id, payload, status, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [String(email || '').toLowerCase(), userId || null, JSON.stringify(payload), status, ip, userAgent]
    )
  } catch (err) {
    console.error('[auth] logging error:', err.message)
    // Don't fail the request if logging fails
  }
}

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  try {
    const { email, password, name } = req.body || {}
    const payload = { email, name, timestamp: new Date().toISOString() }
    
    if (!email || !EMAIL_RE.test(email)) {
      await logLoginAttempt(email, null, payload, 'registration_failed_invalid_email', req)
      return res.status(400).json({ error: 'A valid email is required' })
    }
    if (!password || password.length < 6) {
      await logLoginAttempt(email, null, payload, 'registration_failed_weak_password', req)
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [String(email).toLowerCase()])
    if (existing) {
      await logLoginAttempt(email, existing.id, payload, 'registration_failed_exists', req)
      return res.status(409).json({ error: 'An account with this email already exists' })
    }

    const password_hash = await hashPassword(password)
    const user = await queryOne(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
      [String(email).toLowerCase(), password_hash, (name || '').trim()],
    )

    if (!user) {
      await logLoginAttempt(email, null, payload, 'registration_failed_insert', req)
      return res.status(500).json({ error: 'Failed to create account' })
    }

    await logLoginAttempt(email, user.id, { ...payload, userId: user.id }, 'registration_success', req)
    return res.status(201).json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error('[auth] register error:', err)
    throw err
  }
}))

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  try {
    const { email, password } = req.body || {}
    const payload = { email, timestamp: new Date().toISOString() }
    
    if (!email || !password) {
      await logLoginAttempt(email || 'unknown', null, payload, 'login_failed_missing_credentials', req)
      return res.status(400).json({ error: 'Email and password are required' })
    }

    const user = await queryOne('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()])
    if (!user) {
      await logLoginAttempt(email, null, payload, 'login_failed_user_not_found', req)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    const ok = await verifyPassword(password, user.password_hash)
    if (!ok) {
      await logLoginAttempt(email, user.id, payload, 'login_failed_invalid_password', req)
      return res.status(401).json({ error: 'Invalid email or password' })
    }

    await logLoginAttempt(email, user.id, { ...payload, userId: user.id }, 'login_success', req)
    return res.json({ token: signToken(user), user: publicUser(user) })
  } catch (err) {
    console.error('[auth] login error:', err)
    throw err
  }
}))

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) })
})

// Generate a 6-digit reset code as a zero-padded string.
function makeResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}
const RESET_TTL_MS = 15 * 60 * 1000 // codes are valid for 15 minutes

// POST /api/auth/forgot — start a password reset. With no email service wired
// up, the one-time code is returned directly in the response so the user can
// type it into the reset form ("reset code on screen"). To avoid leaking which
// emails are registered, we always respond 200 — `code` is only present when
// the email actually matches an account.
router.post('/forgot', asyncHandler(async (req, res) => {
  const { email } = req.body || {}
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required' })
  }

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()])
  if (!user) {
    // Don't reveal that the account doesn't exist.
    await logLoginAttempt(email, null, { email }, 'reset_requested_unknown_email', req)
    return res.json({ ok: true, message: 'If that account exists, a reset code has been issued.' })
  }

  const code = makeResetCode()
  const expires = new Date(Date.now() + RESET_TTL_MS)
  await query(
    'UPDATE users SET reset_code = $1, reset_expires = $2 WHERE id = $3',
    [code, expires.toISOString(), user.id],
  )
  await logLoginAttempt(email, user.id, { email }, 'reset_code_issued', req)

  return res.json({
    ok: true,
    message: 'Reset code issued. Enter it along with your new password.',
    code, // shown on screen since there is no email channel
    expiresInMinutes: 15,
  })
}))

// POST /api/auth/reset — complete a reset with { email, code, password }.
router.post('/reset', asyncHandler(async (req, res) => {
  const { email, code, password } = req.body || {}
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' })
  if (!code) return res.status(400).json({ error: 'Reset code is required' })
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()])
  // Same generic error for unknown email / wrong code / expired code so we
  // never reveal which one it was.
  const invalid = () => res.status(400).json({ error: 'Invalid or expired reset code' })
  if (!user || !user.reset_code || user.reset_code !== String(code).trim()) {
    await logLoginAttempt(email, user?.id || null, { email }, 'reset_failed_bad_code', req)
    return invalid()
  }
  const expires = user.reset_expires instanceof Date ? user.reset_expires : new Date(user.reset_expires)
  if (!user.reset_expires || expires.getTime() < Date.now()) {
    await logLoginAttempt(email, user.id, { email }, 'reset_failed_expired', req)
    return invalid()
  }

  const password_hash = await hashPassword(password)
  await query(
    'UPDATE users SET password_hash = $1, reset_code = NULL, reset_expires = NULL WHERE id = $2',
    [password_hash, user.id],
  )
  await logLoginAttempt(email, user.id, { email }, 'reset_success', req)

  // Log the user straight in after a successful reset.
  return res.json({ token: signToken(user), user: publicUser(user) })
}))

export default router
