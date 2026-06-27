// Tiny fetch wrapper for the DropOff backend.
// In dev, BASE is the relative /api path and the Vite dev server proxies it to
// the local Express API (see vite.config.js). In a production build the browser
// calls the Render backend directly at its public URL — CORS is enabled there,
// so we don't depend on a Netlify edge proxy for /api. The backend URL is
// public (it's visible in network requests regardless), so hardcoding it is
// fine and avoids env-var/secret-scanning issues at build time.
// NOTE: the path MUST include /api — the backend mounts every router under
// /api (see server/src/index.js). Dropping it makes requests hit /auth/login
// instead of /api/auth/login, which 404s.
const PROD_API = 'https://dropoff-api-xocp.onrender.com/api'
const BASE = import.meta.env.PROD ? PROD_API : '/api'
const TOKEN_KEY = 'dropoff.token'

// --- Token store (sessionStorage) -----------------------------------------
// The JWT is attached as a Bearer header on every request when present.
// We use sessionStorage (not localStorage) so the session ends when the
// browser/tab is closed — the user must log in again on next open.

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch { /* storage unavailable — token stays in memory via AuthContext */ }
}

// Thrown for any non-2xx response, carrying the server's error message + status.
export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    // Network failure / server down.
    throw new ApiError('Could not reach the server. Is the API running?', 0)
  }

  // 204 / empty body
  const text = await res.text()
  const data = text ? safeParse(text) : {}

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status)
  }
  return data
}

function safeParse(text) {
  try { return JSON.parse(text) } catch { return null }
}

// --- Endpoints -------------------------------------------------------------

// POST /api/quotes → { quotes: [...] }  (all service tiers)
export async function fetchQuotes({ fromCode, toCode, fromState, toState, weightKg }) {
  const data = await request('/quotes', {
    method: 'POST',
    body: { fromCode, toCode, fromState, toState, weightKg },
  })
  return data.quotes
}

// POST /api/shipments → { shipment: {... trackingNumber ...} }
export async function createShipment(payload) {
  const data = await request('/shipments', { method: 'POST', body: payload })
  return data.shipment
}

// GET /api/tracking/:tracking → { tracking: {...} }  (null on 404)
export async function fetchTracking(trackingNumber) {
  try {
    const data = await request(`/tracking/${encodeURIComponent(trackingNumber)}`)
    return data.tracking
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// --- Auth ------------------------------------------------------------------

// POST /api/auth/register → { token, user }
export async function register({ email, password, name }) {
  return request('/auth/register', { method: 'POST', body: { email, password, name } })
}

// POST /api/auth/login → { token, user }
export async function login({ email, password }) {
  return request('/auth/login', { method: 'POST', body: { email, password } })
}

// GET /api/auth/me → { user }  (requires a valid token)
export async function fetchMe() {
  const data = await request('/auth/me')
  return data.user
}

// POST /api/auth/forgot → { ok, message, code?, expiresInMinutes? }
// With no email service, the one-time code comes back in the response so it can
// be shown on screen.
export async function forgotPassword({ email }) {
  return request('/auth/forgot', { method: 'POST', body: { email } })
}

// POST /api/auth/reset → { token, user }  (logs the user in on success)
export async function resetPassword({ email, code, password }) {
  return request('/auth/reset', { method: 'POST', body: { email, code, password } })
}

// GET /api/shipments → [shipment, ...]  (the logged-in user's shipments)
export async function fetchMyShipments() {
  const data = await request('/shipments')
  return data.shipments
}

// NOTE: Customers cannot change shipment status. Stage control is admin-only —
// see adminSetStage below (PATCH /api/admin/shipments/:tracking/stage).

// --- Admin (require an admin token) ----------------------------------------

// GET /api/admin/stats → overview metrics for the admin dashboard
export async function fetchAdminStats() {
  const data = await request('/admin/stats')
  return data.stats
}

// GET /api/admin/shipments → [shipment, ...] (every user's shipments)
export async function fetchAllShipments() {
  const data = await request('/admin/shipments')
  return data.shipments
}

// GET /api/admin/shipments/:tracking → shipment (any owner), null on 404
export async function fetchAdminShipment(trackingNumber) {
  try {
    const data = await request(`/admin/shipments/${encodeURIComponent(trackingNumber)}`)
    return data.shipment
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

// PATCH /api/admin/shipments/:tracking/stage → shipment
// Set a shipment to any stage (forward or backward). Pass { toIndex } or { toStage }.
export async function adminSetStage(trackingNumber, opts = {}) {
  const data = await request(`/admin/shipments/${encodeURIComponent(trackingNumber)}/stage`, {
    method: 'PATCH',
    body: opts,
  })
  return data.shipment
}
