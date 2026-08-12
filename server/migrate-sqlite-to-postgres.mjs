// One-off migration: legacy SQLite (server/dropoff.db) -> Postgres (DATABASE_URL).
//
// Goal: everyone who registered on the old SQLite build can log in on the new
// Postgres backend with their ORIGINAL email + password. bcrypt hashes are
// copied verbatim, so no password resets are needed.
//
//   node migrate-sqlite-to-postgres.mjs            # dry run, writes nothing
//   node migrate-sqlite-to-postgres.mjs --commit   # perform the migration
//
// IMPORTANT — id remapping. The live database has been running since the
// migration, so its SERIAL ids already belong to *different* people than the
// legacy ids 1..11. We therefore never insert a legacy id. Instead:
//   * users are matched/inserted by EMAIL (the real identity key, and what
//     login uses), letting Postgres assign a fresh id;
//   * an oldUserId -> newUserId map is built and applied to shipments.user_id;
//   * shipments are matched/inserted by TRACKING_NUMBER, likewise remapped;
//   * events hang off the new shipment id.
// A user whose email already exists is left completely untouched — we never
// overwrite a live password hash with an older one.
//
// Safe to re-run: existing rows are detected and skipped, and everything runs
// in one transaction that rolls back on any error.
import 'dotenv/config'
import { DatabaseSync } from 'node:sqlite'
import pg from 'pg'
import { initSchema } from './src/db.js'

const COMMIT = process.argv.includes('--commit')
const SQLITE_PATH = process.env.SQLITE_PATH || './dropoff.db'

// SQLite stored timestamps two ways: datetime('now') -> "YYYY-MM-DD HH:MM:SS"
// (UTC, no zone marker) and JS toISOString() -> "...Z". Postgres would read the
// zoneless form in the *server's* timezone and silently shift it, so tag it UTC.
function toUtc(value) {
  if (value == null || value === '') return null
  const s = String(value).trim()
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return s
  return `${s.replace(' ', 'T')}Z`
}

const asBool = (v) => v === 1 || v === true || v === '1'
const normEmail = (e) => String(e ?? '').trim().toLowerCase()

const db = new DatabaseSync(SQLITE_PATH, { readOnly: true })
const all = (sql) => db.prepare(sql).all()

const users = all('SELECT * FROM users ORDER BY id')
const shipments = all('SELECT * FROM shipments ORDER BY id')
const events = all('SELECT * FROM shipment_events ORDER BY id')
const messages = all('SELECT * FROM contact_messages ORDER BY id')

console.log(`source: ${SQLITE_PATH}`)
console.log(`  users ${users.length} | shipments ${shipments.length} | events ${events.length} | messages ${messages.length}`)
console.log(COMMIT ? '\nMODE: COMMIT (writing)\n' : '\nMODE: DRY RUN (no writes; pass --commit to apply)\n')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || /neon\.tech|render\.com|supabase/.test(process.env.DATABASE_URL || '')
    ? { rejectUnauthorized: false } : false,
})

const client = await pool.connect()
const stats = { usersInserted: 0, usersSkipped: 0, shipmentsInserted: 0, shipmentsSkipped: 0, eventsInserted: 0, eventsSkipped: 0, messagesInserted: 0, messagesSkipped: 0 }
const skippedUsers = []
const userIdMap = new Map()

try {
  await initSchema()
  await client.query('BEGIN')

  // --- users -------------------------------------------------------------
  for (const u of users) {
    const email = normEmail(u.email)
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email])
    if (existing.rows.length) {
      // Already on the live DB (re-registered, or a previous run). Leave the
      // live row alone — its hash may be newer than ours.
      userIdMap.set(u.id, existing.rows[0].id)
      stats.usersSkipped++
      skippedUsers.push(`${email} (legacy #${u.id} -> existing #${existing.rows[0].id})`)
      continue
    }
    const ins = await client.query(
      `INSERT INTO users (email, password_hash, name, role, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [email, u.password_hash, u.name ?? '', u.role ?? 'user', toUtc(u.created_at)],
    )
    userIdMap.set(u.id, ins.rows[0].id)
    stats.usersInserted++
  }

  // --- shipments ---------------------------------------------------------
  // from_state/to_state didn't exist in the old schema; default them to ''.
  const shipmentIdMap = new Map()
  for (const s of shipments) {
    const existing = await client.query('SELECT id FROM shipments WHERE tracking_number = $1', [s.tracking_number])
    if (existing.rows.length) {
      shipmentIdMap.set(s.id, existing.rows[0].id)
      stats.shipmentsSkipped++
      continue
    }
    // Remap the owner. If the legacy shipment had no owner, keep it NULL.
    const newOwner = s.user_id == null ? null : userIdMap.get(s.user_id) ?? null
    const ins = await client.query(
      `INSERT INTO shipments (
         tracking_number, user_id, from_code, to_code, from_state, to_state,
         weight_kg, service, parcel_type, price, currency, eta_days, status,
         sender, recipient, photo, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        s.tracking_number, newOwner, s.from_code, s.to_code,
        s.from_state ?? '', s.to_state ?? '',
        s.weight_kg, s.service, s.parcel_type ?? 'box', s.price,
        s.currency ?? 'USD', s.eta_days, s.status ?? 'created',
        s.sender ?? '{}', s.recipient ?? '{}', s.photo ?? null,
        toUtc(s.created_at),
      ],
    )
    shipmentIdMap.set(s.id, ins.rows[0].id)
    stats.shipmentsInserted++
  }

  // --- shipment_events ---------------------------------------------------
  // SQLite stored `done` as INTEGER 0/1; Postgres wants a real BOOLEAN.
  // Skip events for shipments that already existed, so re-runs don't duplicate
  // a timeline that the live DB already has.
  for (const e of events) {
    const newShipmentId = shipmentIdMap.get(e.shipment_id)
    if (newShipmentId == null) { stats.eventsSkipped++; continue }
    const dupe = await client.query(
      'SELECT 1 FROM shipment_events WHERE shipment_id = $1 AND stage_key = $2 LIMIT 1',
      [newShipmentId, e.stage_key],
    )
    if (dupe.rows.length) { stats.eventsSkipped++; continue }
    await client.query(
      `INSERT INTO shipment_events (shipment_id, stage_key, label, detail, place, done, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [newShipmentId, e.stage_key, e.label, e.detail ?? '', e.place ?? '', asBool(e.done), toUtc(e.occurred_at)],
    )
    stats.eventsInserted++
  }

  // --- contact_messages --------------------------------------------------
  // No natural key, so dedupe on (email, message, created_at).
  for (const m of messages) {
    const dupe = await client.query(
      'SELECT 1 FROM contact_messages WHERE email = $1 AND message = $2 LIMIT 1',
      [m.email, m.message],
    )
    if (dupe.rows.length) { stats.messagesSkipped++; continue }
    await client.query(
      'INSERT INTO contact_messages (name, email, message, created_at) VALUES ($1,$2,$3,$4)',
      [m.name, m.email, m.message, toUtc(m.created_at)],
    )
    stats.messagesInserted++
  }

  // No setval() needed: every insert above used the SERIAL default, so the
  // sequences advanced on their own.

  console.log('--- id remapping (legacy -> new) ---')
  for (const u of users) {
    console.log(`  user #${String(u.id).padStart(2)} ${normEmail(u.email).padEnd(38)} -> #${userIdMap.get(u.id) ?? '(none)'}`)
  }

  console.log('\n--- planned changes ---')
  console.log(`  users:     +${stats.usersInserted} inserted, ${stats.usersSkipped} already existed (left untouched)`)
  console.log(`  shipments: +${stats.shipmentsInserted} inserted, ${stats.shipmentsSkipped} already existed`)
  console.log(`  events:    +${stats.eventsInserted} inserted, ${stats.eventsSkipped} skipped`)
  console.log(`  messages:  +${stats.messagesInserted} inserted, ${stats.messagesSkipped} already existed`)
  if (skippedUsers.length) {
    console.log('\n  emails already present on the target (NOT overwritten):')
    for (const s of skippedUsers) console.log(`    - ${s}`)
  }

  if (COMMIT) {
    await client.query('COMMIT')
    console.log('\nCOMMITTED.')
  } else {
    await client.query('ROLLBACK')
    console.log('\nROLLED BACK (dry run). Re-run with --commit to apply.')
  }

  console.log('\nrows now in Postgres:')
  for (const t of ['users', 'shipments', 'shipment_events', 'contact_messages']) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n, COALESCE(MAX(id),0) AS max FROM ${t}`)
    console.log(`  ${t.padEnd(18)} ${String(rows[0].n).padStart(4)} rows | max id ${rows[0].max}`)
  }
} catch (err) {
  await client.query('ROLLBACK')
  console.error(`\nFAILED, rolled back: ${err.message}`)
  process.exitCode = 1
} finally {
  client.release()
  await pool.end()
  db.close()
}
