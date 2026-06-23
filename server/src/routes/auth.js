import { Router } from 'express'
import { queryOne } from '../db.js'
import { hashPassword, verifyPassword, signToken, publicUser, requireAuth } from '../auth.js'
import { asyncHandler } from '../async-handler.js'

const router = Router()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, name } = req.body || {}
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' })
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' })

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase()])
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' })

  const password_hash = await hashPassword(password)
  const user = await queryOne(
    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING *',
    [email.toLowerCase(), password_hash, (name || '').trim()],
  )

  return res.status(201).json({ token: signToken(user), user: publicUser(user) })
}))

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' })

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase()])
  if (!user) return res.status(401).json({ error: 'Invalid email or password' })

  const ok = await verifyPassword(password, user.password_hash)
  if (!ok) return res.status(401).json({ error: 'Invalid email or password' })

  return res.json({ token: signToken(user), user: publicUser(user) })
}))

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) })
})

export default router
