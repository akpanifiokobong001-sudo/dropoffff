// End-to-end proof that migrated credentials still work:
//   1. build a SQLite DB in the OLD schema with a user whose password we know
//   2. run the real migration script against it
//   3. log in over HTTP through the real API and use the returned JWT
import { DatabaseSync } from 'node:sqlite'
import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import bcrypt from 'bcryptjs'

const API = process.env.API_URL || 'http://localhost:4399'
const PG = process.env.PROBE_DATABASE_URL
const TMP = './__e2e-legacy.db'
const PASSWORD = 'LegacyPassw0rd!'
const EMAIL = 'legacy.user@example.com'

let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

// --- 1. Legacy-schema SQLite DB (no `role` column, datetime('now') strings) ---
rmSync(TMP, { force: true })
const db = new DatabaseSync(TMP)
db.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT, tracking_number TEXT NOT NULL UNIQUE,
    user_id INTEGER, from_code TEXT NOT NULL, to_code TEXT NOT NULL,
    weight_kg REAL NOT NULL, service TEXT NOT NULL, parcel_type TEXT NOT NULL DEFAULT 'box',
    price REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'USD', eta_days INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'created', sender TEXT NOT NULL DEFAULT '{}',
    recipient TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')), photo TEXT
  );
  CREATE TABLE shipment_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, shipment_id INTEGER NOT NULL,
    stage_key TEXT NOT NULL, label TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
    place TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0, occurred_at TEXT
  );
  CREATE TABLE contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL,
    message TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
// Hash generated exactly as the old app did: bcryptjs, cost 10.
const hash = await bcrypt.hash(PASSWORD, 10)
db.prepare('INSERT INTO users (email, password_hash, name, created_at) VALUES (?, ?, ?, ?)')
  .run(EMAIL, hash, 'Legacy User', '2026-06-02 16:45:12')
db.prepare(`INSERT INTO shipments
  (tracking_number, user_id, from_code, to_code, weight_kg, service, price, eta_days, status, created_at)
  VALUES ('DROP-E2E-0001', 1, 'GB', 'NG', 2.5, 'express', 86.44, 3, 'transit', '2026-06-02 16:44:44')`).run()
db.prepare(`INSERT INTO shipment_events (shipment_id, stage_key, label, done, occurred_at)
  VALUES (1, 'created', 'Label created', 1, '2026-06-02T16:44:44.352Z')`).run()
db.close()
console.log(`built legacy fixture with ${EMAIL} / ${PASSWORD}\n`)

// --- 2. Run the real migration script ---------------------------------------
const out = execFileSync(
  process.execPath,
  ['--no-warnings', 'migrate-sqlite-to-postgres.mjs', '--commit'],
  { env: { ...process.env, DATABASE_URL: PG, SQLITE_PATH: TMP, NODE_ENV: 'development' }, encoding: 'utf8' },
)
check('migration script committed', out.includes('COMMITTED'))

// --- 3. Log in over real HTTP ------------------------------------------------
const login = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})
const body = await login.json()
check('HTTP login with ORIGINAL password succeeds', login.status === 200, `status ${login.status} ${JSON.stringify(body).slice(0, 120)}`)
check('login returns a JWT', typeof body.token === 'string' && body.token.length > 20)
check('login returns the migrated user', body.user?.email === EMAIL, JSON.stringify(body.user))

// Mixed-case email must still resolve (routes lowercase the input).
const upper = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL.toUpperCase(), password: PASSWORD }),
})
check('login works with UPPERCASE email', upper.status === 200, `status ${upper.status}`)

// Wrong password must still be rejected.
const bad = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: 'nope' }),
})
check('wrong password rejected', bad.status === 401, `status ${bad.status}`)

// --- 4. The JWT works on an authenticated route, and history came across -----
if (body.token) {
  const me = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${body.token}` } })
  const meBody = await me.json()
  check('token authenticates /api/auth/me', me.status === 200, `status ${me.status}`)
  check('identity preserved', meBody.user?.email === EMAIL || meBody.email === EMAIL, JSON.stringify(meBody).slice(0, 100))

  const ships = await fetch(`${API}/api/shipments`, { headers: { Authorization: `Bearer ${body.token}` } })
  const shipBody = await ships.json()
  const list = Array.isArray(shipBody) ? shipBody : shipBody.shipments || []
  check('migrated shipment still linked to the user', list.some((s) => s.trackingNumber === 'DROP-E2E-0001'),
    `got ${list.map((s) => s.trackingNumber).join(',') || 'none'}`)
}

// --- 5. Tracking resolves the migrated shipment for its owner ----------------
// GET /api/tracking/:n is owner-only (requireAuth + user_id check), so this
// doubles as a check that the migrated user_id still matches the JWT subject.
if (body.token) {
  const track = await fetch(`${API}/api/tracking/DROP-E2E-0001`, {
    headers: { Authorization: `Bearer ${body.token}` },
  })
  const tBody = await track.json()
  check('owner can track migrated shipment', track.status === 200, `status ${track.status}`)
  check('migrated timeline came across', (tBody.tracking?.timeline?.length ?? 0) > 0,
    `${tBody.tracking?.timeline?.length ?? 0} stages, status=${tBody.tracking?.status}`)

  // A different user must NOT see it — confirms ownership survived intact.
  const other = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'stranger@example.com', password: 'Str4ngerPass!', name: 'Stranger' }),
  })
  const otherBody = await other.json()
  if (otherBody.token) {
    const denied = await fetch(`${API}/api/tracking/DROP-E2E-0001`, {
      headers: { Authorization: `Bearer ${otherBody.token}` },
    })
    check("another user cannot track someone else's migrated shipment", denied.status === 404, `status ${denied.status}`)
  }
}

rmSync(TMP, { force: true })
rmSync(`${TMP}-shm`, { force: true })
rmSync(`${TMP}-wal`, { force: true })
console.log(fails === 0 ? '\nALL E2E CHECKS PASSED' : `\n${fails} E2E CHECK(S) FAILED`)
if (fails) process.exitCode = 1
