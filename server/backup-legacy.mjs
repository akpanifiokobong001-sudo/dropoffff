// Consolidates the legacy SQLite DB (main file + WAL) into two portable
// artifacts under backup/: a checkpointed .db and a plain JSON dump.
import { DatabaseSync } from 'node:sqlite'
import { writeFileSync, copyFileSync } from 'node:fs'

// Opening read-write and checkpointing folds the 2.2MB WAL into the main file,
// so the backup copy is self-contained rather than a 4KB stub.
const live = new DatabaseSync('./dropoff.db')
live.exec('PRAGMA wal_checkpoint(TRUNCATE)')
live.close()

copyFileSync('./dropoff.db', './backup/dropoff-checkpointed.db')

const db = new DatabaseSync('./backup/dropoff-checkpointed.db', { readOnly: true })
const dump = {}
for (const { name } of db.prepare(
  "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
).all()) {
  dump[name] = db.prepare(`SELECT * FROM "${name}" ORDER BY id`).all()
}
db.close()

writeFileSync('./backup/dropoff-dump.json', JSON.stringify(dump, null, 2))
for (const [t, rows] of Object.entries(dump)) console.log(`  ${t.padEnd(18)} ${rows.length} rows`)
console.log('\nwrote backup/dropoff-checkpointed.db and backup/dropoff-dump.json')
