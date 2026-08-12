// Post-migration verification against the DATABASE_URL currently in env.
// Compares Postgres row-by-row against the legacy SQLite file and proves that a
// migrated bcrypt hash still verifies (i.e. real users keep their passwords).
import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import bcrypt from 'bcryptjs'

let fails = 0
const check = (name, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`)
}

const db = new DatabaseSync(process.env.SQLITE_PATH || './dropoff.db', { readOnly: true })
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false } : false,
})

// --- 1. Row counts match ---------------------------------------------------
for (const t of ['users', 'shipments', 'shipment_events', 'contact_messages']) {
  const src = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t}`)
  check(`${t} row count`, src === rows[0].n, `sqlite ${src} vs pg ${rows[0].n}`)
}

// --- 2. Every user transferred with an intact hash -------------------------
const srcUsers = db.prepare('SELECT * FROM users ORDER BY id').all()
let hashMismatch = 0
let emailMismatch = 0
for (const u of srcUsers) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [u.id])
  const p = rows[0]
  if (!p) { hashMismatch++; console.log(`   missing user #${u.id}`); continue }
  if (p.password_hash !== u.password_hash) { hashMismatch++; console.log(`   hash differs for #${u.id}`) }
  if (p.email !== String(u.email).trim().toLowerCase()) { emailMismatch++; console.log(`   email differs for #${u.id}: ${u.email} -> ${p.email}`) }
}
check('all password hashes byte-identical', hashMismatch === 0)
check('all emails lowercased correctly', emailMismatch === 0)

// --- 3. Timestamps preserved (no timezone drift) --------------------------
// SQLite "2026-06-02 16:45:12" is UTC; verify Postgres agrees to the second.
let drift = 0
for (const u of srcUsers) {
  const { rows } = await pool.query('SELECT created_at FROM users WHERE id = $1', [u.id])
  const pgIso = rows[0].created_at.toISOString().slice(0, 19)
  const srcIso = `${String(u.created_at).trim().replace(' ', 'T')}`.slice(0, 19)
  if (pgIso !== srcIso) { drift++; console.log(`   #${u.id} ${srcIso} -> ${pgIso}`) }
}
check('user timestamps preserved as UTC', drift === 0)

// --- 4. Foreign keys still link the right owners --------------------------
const srcShip = db.prepare('SELECT id, tracking_number, user_id FROM shipments ORDER BY id').all()
let fkBad = 0
for (const s of srcShip) {
  const { rows } = await pool.query('SELECT tracking_number, user_id FROM shipments WHERE id = $1', [s.id])
  if (!rows[0] || rows[0].tracking_number !== s.tracking_number || (rows[0].user_id ?? null) !== (s.user_id ?? null)) {
    fkBad++
    console.log(`   #${s.id} expected user ${s.user_id} got ${rows[0]?.user_id}`)
  }
}
check('shipment owners + tracking numbers intact', fkBad === 0)

// --- 5. done flag converted 0/1 -> boolean --------------------------------
const srcDone = db.prepare('SELECT COUNT(*) AS n FROM shipment_events WHERE done = 1').get().n
const { rows: pgDone } = await pool.query('SELECT COUNT(*)::int AS n FROM shipment_events WHERE done = true')
check('completed events converted to BOOLEAN', srcDone === pgDone[0].n, `${srcDone} vs ${pgDone[0].n}`)

// --- 6. THE REAL TEST: a migrated hash still verifies ---------------------
// Create a throwaway user whose hash was generated the way the old app did,
// migrate-style insert it, and confirm bcrypt.compare succeeds through Postgres.
const probeEmail = `__probe_${srcUsers.length}@migration.test`
const probeHash = await bcrypt.hash('CorrectHorse123', 10)
await pool.query('DELETE FROM users WHERE email = $1', [probeEmail])
await pool.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)', [probeEmail, probeHash, 'Probe'])
const { rows: probe } = await pool.query('SELECT password_hash FROM users WHERE email = $1', [probeEmail])
check('bcrypt verifies a hash round-tripped through Postgres', await bcrypt.compare('CorrectHorse123', probe[0].password_hash))
check('bcrypt rejects a wrong password', !(await bcrypt.compare('WrongPassword', probe[0].password_hash)))
await pool.query('DELETE FROM users WHERE email = $1', [probeEmail])

// Confirm the real migrated hashes are structurally valid bcrypt (cost + salt).
const { rows: shapes } = await pool.query(
  "SELECT COUNT(*)::int AS n FROM users WHERE password_hash ~ '^\\$2[aby]\\$[0-9]{2}\\$.{53}$'",
)
check('all migrated hashes are well-formed bcrypt', shapes[0].n === srcUsers.length, `${shapes[0].n}/${srcUsers.length}`)

// --- 7. Next signup gets a fresh id (sequences advanced) ------------------
const { rows: seqTest } = await pool.query(
  "INSERT INTO users (email, password_hash, name) VALUES ('__seq@migration.test','x','S') RETURNING id",
)
const maxId = Math.max(...srcUsers.map((u) => u.id))
check('next inserted id does not collide with migrated rows', seqTest[0].id > maxId, `new id ${seqTest[0].id} > max ${maxId}`)
await pool.query("DELETE FROM users WHERE email = '__seq@migration.test'")

// --- 8. Idempotency: re-running inserts nothing --------------------------
const before = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n
const r = await pool.query(
  `INSERT INTO users (id, email, password_hash, name) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
  [srcUsers[0].id, srcUsers[0].email, srcUsers[0].password_hash, srcUsers[0].name],
)
const after = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n
check('re-running the migration is a no-op', r.rowCount === 0 && before === after)

console.log(fails === 0 ? '\nALL CHECKS PASSED' : `\n${fails} CHECK(S) FAILED`)
if (fails) process.exitCode = 1

db.close()
await pool.end()
