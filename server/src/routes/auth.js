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

export default router
