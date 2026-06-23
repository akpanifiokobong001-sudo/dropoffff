// Postgres database layer for DropOff, using the `pg` driver.
// Connection comes from DATABASE_URL (Render Postgres provides this). In
// production we enable SSL (Render requires it); locally SSL is off.
import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

// --- Query helpers ---------------------------------------------------------
// Keep route code terse: query() returns all rows, queryOne() returns the
// first row (or null). Both take ($1, $2, ...) positional params.

export async function query(text, params) {
  const res = await pool.query(text, params)
  return res.rows
}

export async function queryOne(text, params) {
  const res = await pool.query(text, params)
  return res.rows[0] ?? null
}

// --- Schema ----------------------------------------------------------------
// Created once on startup (idempotent). Must be awaited before app.listen()
// — see index.js. Mirrors the previous SQLite schema, translated to Postgres:
// SERIAL ids, TIMESTAMPTZ defaults, BOOLEAN for shipment_events.done.
export async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL DEFAULT '',
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shipments (
      id              SERIAL PRIMARY KEY,
      tracking_number TEXT NOT NULL UNIQUE,
      user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      from_code       TEXT NOT NULL,
      to_code         TEXT NOT NULL,
      from_state      TEXT NOT NULL DEFAULT '',
      to_state        TEXT NOT NULL DEFAULT '',
      weight_kg       REAL NOT NULL,
      service         TEXT NOT NULL,
      parcel_type     TEXT NOT NULL DEFAULT 'box',
      price           REAL NOT NULL,
      currency        TEXT NOT NULL DEFAULT 'USD',
      eta_days        INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'created',
      sender          TEXT NOT NULL DEFAULT '{}',
      recipient       TEXT NOT NULL DEFAULT '{}',
      photo           TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_shipments_user ON shipments(user_id);

    CREATE TABLE IF NOT EXISTS shipment_events (
      id          SERIAL PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      stage_key   TEXT NOT NULL,
      label       TEXT NOT NULL,
      detail      TEXT NOT NULL DEFAULT '',
      place       TEXT NOT NULL DEFAULT '',
      done        BOOLEAN NOT NULL DEFAULT false,
      occurred_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_events_shipment ON shipment_events(shipment_id);

    CREATE TABLE IF NOT EXISTS contact_messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)

  // Additive migrations for DBs created before a column existed. Postgres
  // supports IF NOT EXISTS directly, so each is a one-liner.
  await pool.query('ALTER TABLE shipments ADD COLUMN IF NOT EXISTS photo TEXT;')
  await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS from_state TEXT NOT NULL DEFAULT '';")
  await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS to_state TEXT NOT NULL DEFAULT '';")
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';")
}

export default pool
