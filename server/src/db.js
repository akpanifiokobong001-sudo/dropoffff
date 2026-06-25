// Postgres database layer for DropOff, using the `pg` driver.
// Connection comes from DATABASE_URL (Render Postgres provides this). In
// production we enable SSL (Render requires it); locally SSL is off.
import pg from 'pg'

const { Pool } = pg

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.DATABASE_URL?.includes('neon.tech') 
    ? { rejectUnauthorized: false } 
    : false,
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

    CREATE TABLE IF NOT EXISTS login_logs (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      payload    JSONB NOT NULL,
      status     TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_login_logs_user ON login_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_login_logs_email ON login_logs(email);
    CREATE INDEX IF NOT EXISTS idx_login_logs_created ON login_logs(created_at);

    CREATE TABLE IF NOT EXISTS booking_logs (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      shipment_id INTEGER REFERENCES shipments(id) ON DELETE SET NULL,
      payload    JSONB NOT NULL,
      status     TEXT NOT NULL,
      error_message TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_booking_logs_user ON booking_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_booking_logs_shipment ON booking_logs(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_booking_logs_created ON booking_logs(created_at);

    CREATE TABLE IF NOT EXISTS progress_logs (
      id          SERIAL PRIMARY KEY,
      shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      -- Nullable: the very first 'created' event has no prior stage to come from.
      from_stage  TEXT,
      to_stage    TEXT NOT NULL,
      stage_index INTEGER NOT NULL,
      change_payload JSONB,
      ip_address  TEXT,
      user_agent  TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_progress_logs_shipment ON progress_logs(shipment_id);
    CREATE INDEX IF NOT EXISTS idx_progress_logs_user ON progress_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_progress_logs_created ON progress_logs(created_at);
  `)

  // Additive migrations for DBs created before a column existed. Postgres
  // supports IF NOT EXISTS directly, so each is a one-liner.
  await pool.query('ALTER TABLE shipments ADD COLUMN IF NOT EXISTS photo TEXT;')
  await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS from_state TEXT NOT NULL DEFAULT '';")
  await pool.query("ALTER TABLE shipments ADD COLUMN IF NOT EXISTS to_state TEXT NOT NULL DEFAULT '';")
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';")
  // Password-reset code (one-time) + its expiry. Cleared once used.
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;')
  await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;')
  // The initial 'created' progress event has no prior stage, so from_stage must
  // allow NULL. Older DBs created the column NOT NULL — relax it here.
  await pool.query('ALTER TABLE progress_logs ALTER COLUMN from_stage DROP NOT NULL;')
}

export default pool
