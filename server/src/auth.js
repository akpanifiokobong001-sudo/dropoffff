// Auth helpers: password hashing (bcryptjs) + JWT issuing/verifying + Express middleware.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { queryOne } from './db.js'
import { asyncHandler } from './async-handler.js'

// In a real deployment this would come from a secret manager; fine for local/dev.
const JWT_SECRET = process.env.JWT_SECRET || 'dropoff-dev-secret-change-me'
const JWT_EXPIRES_IN = '7d'

// Admin accounts are designated by email via the ADMIN_EMAILS env var
// (comma-separated). This is the single source of truth for who is an admin:
// adding an email here promotes that account on its next request — no DB write
// needed. Matching is case-insensitive.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .toLowerCase()
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.has(String(email).toLowerCase())
}

// The effective role for a user row: an ADMIN_EMAILS match always wins, else
// fall back to the stored role column (defaults to 'user').
export function roleFor(row) {
  if (!row) return null
  return isAdminEmail(row.email) ? 'admin' : row.role || 'user'
}

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: roleFor(user) },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  )
}

// Strip sensitive fields before sending a user to the client.
export function publicUser(row) {
  if (!row) return null
  // pg returns TIMESTAMPTZ as a Date; keep the wire shape an ISO string.
  const createdAt = row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
  return { id: row.id, email: row.email, name: row.name, role: roleFor(row), createdAt }
}

function readToken(req) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')
  if (scheme === 'Bearer' && token) return token
  return null
}

// Attaches req.user if a valid token is present, else null. Never blocks.
// Wrapped in asyncHandler so a DB error forwards to the error middleware
// rather than leaving the request hanging.
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req)
  req.user = null
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET)
      const row = await queryOne('SELECT * FROM users WHERE id = $1', [payload.sub])
      if (row) req.user = row
    } catch {
      // ignore invalid/expired token for optional auth
    }
  }
  next()
})

// Requires a valid token, else 401.
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = readToken(req)
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  let payload
  try {
    payload = jwt.verify(token, JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
  // A DB lookup failure here should surface as a 500 (via next(err)), not be
  // masked as an auth failure — so it sits outside the verify try/catch.
  const row = await queryOne('SELECT * FROM users WHERE id = $1', [payload.sub])
  if (!row) return res.status(401).json({ error: 'User no longer exists' })
  req.user = row
  next()
})

// Requires a valid token AND admin privileges, else 401/403. Runs requireAuth
// first (so req.user is loaded), then checks the effective role.
export const requireAdmin = [
  requireAuth,
  (req, res, next) => {
    if (roleFor(req.user) !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' })
    }
    next()
  },
]
