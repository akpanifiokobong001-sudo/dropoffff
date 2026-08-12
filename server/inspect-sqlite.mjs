// Read-only inspection of the legacy SQLite DB (incl. its WAL) before migrating.
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('./dropoff.db', { readOnly: true })

const tables = db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).all()

console.log('=== TABLES + ROW COUNTS ===')
for (const { name } of tables) {
  const { n } = db.prepare(`SELECT COUNT(*) AS n FROM "${name}"`).get()
  console.log(`${String(n).padStart(6)}  ${name}`)
}

const cols = (t) => db.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name)

for (const t of tables.map((t) => t.name)) {
  console.log(`\n=== ${t} SCHEMA ===`)
  for (const c of db.prepare(`PRAGMA table_info("${t}")`).all()) {
    console.log(`  ${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ''}${c.pk ? ' PK' : ''}${c.dflt_value != null ? ` DEFAULT ${c.dflt_value}` : ''}`)
  }
}

console.log('\n=== users (hash prefix only, no full secrets) ===')
const userCols = cols('users')
for (const u of db.prepare('SELECT * FROM users ORDER BY id').all()) {
  const h = u.password_hash || ''
  console.log(`  #${u.id} ${u.email} | name=${JSON.stringify(u.name)} | hash=${h.slice(0, 7)}...(${h.length}) | ${u.created_at}`)
}

console.log('\n=== shipments sample ===')
for (const s of db.prepare('SELECT * FROM shipments ORDER BY id LIMIT 12').all()) {
  console.log(`  #${s.id} ${s.tracking_number} user=${s.user_id} ${s.from_code}->${s.to_code} ${s.status} ${s.price} ${s.created_at}`)
}

console.log('\n=== shipment_events sample ===')
for (const e of db.prepare('SELECT * FROM shipment_events ORDER BY id LIMIT 5').all()) {
  console.log(`  #${e.id} ship=${e.shipment_id} ${e.stage_key} done=${JSON.stringify(e.done)} occurred=${e.occurred_at}`)
}

console.log('\n=== REFERENTIAL INTEGRITY ===')
const scalar = (sql) => db.prepare(sql).get().n
console.log(`  shipments w/ missing user:   ${scalar('SELECT COUNT(*) AS n FROM shipments WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)')}`)
console.log(`  events w/ missing shipment:  ${scalar('SELECT COUNT(*) AS n FROM shipment_events WHERE shipment_id NOT IN (SELECT id FROM shipments)')}`)
console.log(`  dup emails (case-insens.):   ${scalar('SELECT COUNT(*) AS n FROM (SELECT lower(email) e FROM users GROUP BY lower(email) HAVING COUNT(*) > 1)')}`)
console.log(`  non-bcrypt password_hash:    ${scalar("SELECT COUNT(*) AS n FROM users WHERE password_hash IS NULL OR password_hash NOT LIKE '$2%'")}`)
console.log(`  dup tracking numbers:        ${scalar('SELECT COUNT(*) AS n FROM (SELECT tracking_number FROM shipments GROUP BY tracking_number HAVING COUNT(*) > 1)')}`)

// Distinct bcrypt prefixes — $2a$/$2b$/$2y$ are all verifiable by bcryptjs.
console.log('\n=== bcrypt variants ===')
for (const r of db.prepare("SELECT substr(password_hash,1,4) AS p, COUNT(*) AS n FROM users GROUP BY p").all()) {
  console.log(`  ${r.p}  ${r.n}`)
}

// Timestamp formats must parse as Postgres TIMESTAMPTZ.
console.log('\n=== timestamp samples ===')
for (const r of db.prepare('SELECT created_at FROM users LIMIT 3').all()) console.log(`  users.created_at:    ${JSON.stringify(r.created_at)}`)
for (const r of db.prepare('SELECT created_at FROM shipments LIMIT 2').all()) console.log(`  shipments.created_at:${JSON.stringify(r.created_at)}`)
for (const r of db.prepare('SELECT occurred_at FROM shipment_events WHERE occurred_at IS NOT NULL LIMIT 2').all()) console.log(`  events.occurred_at:  ${JSON.stringify(r.occurred_at)}`)

// sender/recipient are JSON-in-TEXT; confirm they parse.
console.log('\n=== sender/recipient JSON validity ===')
let bad = 0
for (const s of db.prepare('SELECT id, sender, recipient FROM shipments').all()) {
  for (const f of ['sender', 'recipient']) {
    try { JSON.parse(s[f] ?? '{}') } catch { bad++; console.log(`  #${s.id} ${f} INVALID: ${String(s[f]).slice(0, 60)}`) }
  }
}
console.log(`  invalid JSON fields: ${bad}`)

db.close()
