// Verifies the email-keyed / id-remapping migration on a production-like target.
import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import bcrypt from 'bcryptjs'

let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}
const normEmail = (e) => String(e ?? '').trim().toLowerCase()

const db = new DatabaseSync('./dropoff.db', { readOnly: true })
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false })

const srcUsers = db.prepare('SELECT * FROM users ORDER BY id').all()
const srcShip = db.prepare('SELECT * FROM shipments ORDER BY id').all()

// --- 1. Every legacy email is now present -------------------------------
let missing = 0
for (const u of srcUsers) {
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [normEmail(u.email)])
  if (!rows.length) { missing++; console.log(`   missing ${u.email}`) }
}
check('every legacy email exists on the target', missing === 0)

// --- 2. Hashes copied verbatim, EXCEPT the pre-existing one -------------
let copied = 0, preserved = 0, wrong = 0
for (const u of srcUsers) {
  const { rows } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [normEmail(u.email)])
  if (!rows.length) continue
  if (rows[0].password_hash === u.password_hash) copied++
  else if (normEmail(u.email) === 'testmem80@gmail.com') preserved++
  else { wrong++; console.log(`   unexpected hash change for ${u.email}`) }
}
check('legacy hashes copied verbatim', copied === srcUsers.length - 1, `${copied}/${srcUsers.length - 1}`)
check('pre-existing live account kept its NEWER password', preserved === 1)
check('no unexpected hash changes', wrong === 0)

// The live user's current password must still work; the old one must not.
const { rows: live } = await pool.query("SELECT password_hash FROM users WHERE email='testmem80@gmail.com'")
check('live account still verifies its current password', await bcrypt.compare('TheirNewPassword123', live[0].password_hash))
const legacyHash = srcUsers.find((u) => normEmail(u.email) === 'testmem80@gmail.com').password_hash
check('live password was NOT rolled back to the legacy hash', live[0].password_hash !== legacyHash)

// --- 3. No unrelated live user was touched ------------------------------
const { rows: untouched } = await pool.query(
  "SELECT COUNT(*)::int AS n FROM users WHERE email LIKE 'live_user_%@production.example'",
)
check('all 34 unrelated live users intact', untouched[0].n === 34, `${untouched[0].n}/34`)
const { rows: sample } = await pool.query("SELECT password_hash FROM users WHERE email='live_user_7@production.example'")
check('an unrelated live user can still log in', await bcrypt.compare('LivePass7!', sample[0].password_hash))

// --- 4. Shipment ownership correctly REMAPPED --------------------------
// The whole point: shipment 8 belonged to legacy user 5, who is now a new id.
let ownerBad = 0
for (const s of srcShip) {
  const { rows } = await pool.query('SELECT user_id FROM shipments WHERE tracking_number = $1', [s.tracking_number])
  if (!rows.length) { ownerBad++; console.log(`   missing shipment ${s.tracking_number}`); continue }
  if (s.user_id == null) {
    if (rows[0].user_id !== null) { ownerBad++; console.log(`   ${s.tracking_number} should be unowned`) }
    continue
  }
  // Resolve the legacy owner's email, then the new id for that email.
  const legacyOwner = srcUsers.find((u) => u.id === s.user_id)
  const { rows: expect } = await pool.query('SELECT id FROM users WHERE email = $1', [normEmail(legacyOwner.email)])
  if (rows[0].user_id !== expect[0].id) {
    ownerBad++
    console.log(`   ${s.tracking_number}: user_id ${rows[0].user_id} != expected ${expect[0].id} (${legacyOwner.email})`)
  }
}
check('every shipment points at its original owner (remapped)', ownerBad === 0)

// No shipment should reference a non-existent user.
const { rows: orphan } = await pool.query(
  'SELECT COUNT(*)::int AS n FROM shipments s WHERE s.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)',
)
check('no orphaned shipment owners', orphan[0].n === 0)

// --- 5. Events attached to the right shipments -------------------------
let evBad = 0
for (const s of srcShip) {
  const srcCount = db.prepare('SELECT COUNT(*) AS n FROM shipment_events WHERE shipment_id = ?').get(s.id).n
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM shipment_events e
     JOIN shipments sh ON sh.id = e.shipment_id WHERE sh.tracking_number = $1`,
    [s.tracking_number],
  )
  if (rows[0].n !== srcCount) { evBad++; console.log(`   ${s.tracking_number}: ${rows[0].n} events, expected ${srcCount}`) }
}
check('each shipment has its full event timeline', evBad === 0)

// --- 6. Idempotency: a second run must change nothing ------------------
const before = await pool.query('SELECT COUNT(*)::int AS n FROM users')
const beforeShip = await pool.query('SELECT COUNT(*)::int AS n FROM shipments')
const beforeEv = await pool.query('SELECT COUNT(*)::int AS n FROM shipment_events')
const { execFileSync } = await import('node:child_process')
execFileSync(process.execPath, ['--no-warnings', 'migrate-sqlite-to-postgres.mjs', '--commit'],
  { env: { ...process.env }, encoding: 'utf8' })
const after = await pool.query('SELECT COUNT(*)::int AS n FROM users')
const afterShip = await pool.query('SELECT COUNT(*)::int AS n FROM shipments')
const afterEv = await pool.query('SELECT COUNT(*)::int AS n FROM shipment_events')
check('re-running adds no duplicate users', before.rows[0].n === after.rows[0].n, `${before.rows[0].n} -> ${after.rows[0].n}`)
check('re-running adds no duplicate shipments', beforeShip.rows[0].n === afterShip.rows[0].n, `${beforeShip.rows[0].n} -> ${afterShip.rows[0].n}`)
check('re-running adds no duplicate events', beforeEv.rows[0].n === afterEv.rows[0].n, `${beforeEv.rows[0].n} -> ${afterEv.rows[0].n}`)

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`)
if (fails) process.exitCode = 1
db.close()
await pool.end()
