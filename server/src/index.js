// DropOff API server — Express + Postgres (pg) + JWT auth.
// Mounts the auth, quotes, shipments, and tracking routers, plus a contact endpoint.
import express from 'express'
import cors from 'cors'

import { query, pool, initSchema } from './db.js'
import { asyncHandler } from './async-handler.js'
import authRoutes from './routes/auth.js'
import quotesRoutes from './routes/quotes.js'
import shipmentsRoutes from './routes/shipments.js'
import trackingRoutes from './routes/tracking.js'
import adminRoutes from './routes/admin.js'

const app = express()
const PORT = Number(process.env.PORT) || 5418

// CORS — allow the Vite dev server (and anything in dev). Tighten with CORS_ORIGIN in prod.
const ORIGIN = process.env.CORS_ORIGIN || true
app.use(cors({ origin: ORIGIN }))
// 2MB allows a compressed parcel photo (sent as a base64 data URL) plus the
// rest of the shipment body. The shipments route caps the photo itself tighter.
app.use(express.json({ limit: '2mb' }))

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'dropoff-api', time: new Date().toISOString() })
})

// Feature routers
app.use('/api/auth', authRoutes)
app.use('/api/quotes', quotesRoutes)
app.use('/api/shipments', shipmentsRoutes)
app.use('/api/tracking', trackingRoutes)
app.use('/api/admin', adminRoutes)

// POST /api/contact — store a contact message (table created in db.js).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
app.post('/api/contact', asyncHandler(async (req, res) => {
  const { name, email, message } = req.body || {}
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' })
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required' })
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'Message is required' })

  const inserted = await query(
    'INSERT INTO contact_messages (name, email, message) VALUES ($1, $2, $3) RETURNING id',
    [String(name).trim(), String(email).toLowerCase().trim(), String(message).trim()],
  )

  return res.status(201).json({ ok: true, id: inserted[0].id })
}))

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Centralized error handler — catches malformed JSON and thrown errors.
app.use((err, _req, res, _next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' })
  }
  console.error('[dropoff] unhandled error:', err)
  return res.status(500).json({ error: 'Internal server error' })
})

// Create the schema, then start listening. Schema init is async (pg), so it
// must complete before we accept requests.
async function start() {
  await initSchema()
  app.listen(PORT, () => {
    console.log(`DropOff API listening on http://localhost:${PORT}`)
  })
}

start().catch((err) => {
  console.error('[dropoff] failed to start:', err)
  process.exit(1)
})

process.on('SIGTERM', () => {
  pool.end().finally(() => process.exit(0))
})

export default app
