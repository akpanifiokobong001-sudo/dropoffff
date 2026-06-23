import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck, Search, Loader2, AlertCircle, MapPin, ArrowRight,
  PackageCheck, Truck, RefreshCw, User, Package, Users, DollarSign, Clock,
} from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import { fetchAdminStats, fetchAllShipments, fetchAdminShipment, adminSetStage } from '../lib/api.js'
import { formatPrice } from '../lib/pricing.js'

// Stage keys/labels mirror the backend's STAGES (shipment-stages.js). The admin
// can set a shipment to any of these, in either direction.
const STAGES = [
  { key: 'created', label: 'Label created' },
  { key: 'pickup', label: 'Picked up' },
  { key: 'origin', label: 'At origin facility' },
  { key: 'transit', label: 'In transit' },
  { key: 'customs', label: 'Customs / regional' },
  { key: 'destination', label: 'At destination facility' },
  { key: 'out', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
]

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Tracking-code search.
  const [code, setCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // The shipment currently selected for stage control (from search or the list).
  const [selected, setSelected] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, list] = await Promise.all([fetchAdminStats(), fetchAllShipments()])
      setStats(s)
      setShipments(list)
    } catch (err) {
      setError(err.message || 'Could not load admin data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  async function onSearch(e) {
    e.preventDefault()
    const tn = code.trim()
    if (!tn) return
    setSearching(true)
    setSearchError('')
    try {
      const found = await fetchAdminShipment(tn)
      if (!found) {
        setSearchError('No shipment found for that tracking number.')
      } else {
        setSelected(found)
      }
    } catch (err) {
      setSearchError(err.message || 'Search failed.')
    } finally {
      setSearching(false)
    }
  }

  async function setStage(toIndex) {
    if (!selected) return
    setUpdating(true)
    setUpdateError('')
    try {
      const updated = await adminSetStage(selected.trackingNumber, { toIndex })
      setSelected(updated)
      // Keep the list in sync without a full refetch.
      setShipments((prev) => prev.map((s) => (s.trackingNumber === updated.trackingNumber ? { ...s, ...updated } : s)))
      // Status counts may have changed — refresh the overview quietly.
      fetchAdminStats().then(setStats).catch(() => {})
    } catch (err) {
      setUpdateError(err.message || 'Could not update the shipment stage.')
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="bg-hero-grad min-h-[80vh]">
      <BackButton className="ml-4 mt-4" />
      <div className="container-x py-14 sm:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="chip mb-3 border border-brand-100 bg-white/70 text-brand-600">
                <ShieldCheck size={14} /> Admin control
              </span>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Admin dashboard</h1>
              <p className="mt-2 text-ink-muted">
                Monitor activity, then look up any shipment by code and move it to any stage.
              </p>
            </div>
            <button onClick={loadAll} className="btn-secondary" disabled={loading}>
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </Reveal>

        {/* Overview stats */}
        <Reveal>
          <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Package} tint="brand" label="Total shipments" value={stats?.totalShipments ?? '—'} />
            <StatCard icon={Truck} tint="amber" label="In transit" value={stats?.inTransit ?? '—'} />
            <StatCard icon={PackageCheck} tint="teal" label="Delivered" value={stats?.delivered ?? '—'} />
            <StatCard icon={Users} tint="brand" label="Users" value={stats?.totalUsers ?? '—'} />
          </div>
        </Reveal>
        <Reveal delay={0.05}>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
                  <DollarSign size={15} className="text-teal-600" /> Total booked value
                </span>
                <Clock size={15} className="text-ink-muted" title="Last 7 days below" />
              </div>
              <div className="mt-2 text-3xl font-extrabold text-ink">{formatPrice(stats?.revenue ?? 0)}</div>
              <div className="mt-1 text-sm text-ink-muted">
                {stats?.recentShipments ?? 0} booked in the last 7 days
              </div>
            </div>
            <div className="card p-5">
              <span className="text-sm font-semibold text-ink-muted">Status breakdown</span>
              <div className="mt-3 flex flex-col gap-2">
                {(stats?.byStatus || []).length === 0 && (
                  <span className="text-sm text-ink-muted">No shipments yet.</span>
                )}
                {(stats?.byStatus || []).map((s) => {
                  const total = stats?.totalShipments || 1
                  const pct = Math.round((s.count / total) * 100)
                  return (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className="w-24 shrink-0 text-sm font-medium capitalize text-ink-soft">{s.status}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-brand-grad" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-8 shrink-0 text-right text-sm font-semibold text-ink">{s.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl">
          {/* Search by tracking code */}
          <Reveal>
            <form onSubmit={onSearch} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter tracking number (e.g. DROP-7X4K-2291)"
                  className="input pl-11 uppercase"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={searching || !code.trim()}>
                {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Find
              </button>
            </form>
          </Reveal>

          {searchError && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle size={16} className="shrink-0" /> {searchError}
            </div>
          )}

          {/* Selected shipment + stage control */}
          {selected && (
            <ControlCard
              shipment={selected}
              onSetStage={setStage}
              updating={updating}
              error={updateError}
              onClose={() => { setSelected(null); setUpdateError('') }}
            />
          )}

          {/* All shipments */}
          <h2 className="mt-10 text-lg font-bold text-ink">All shipments</h2>
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-brand-500" />
            </div>
          )}
          {error && !loading && (
            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}
          {!loading && !error && shipments.length === 0 && (
            <p className="mt-4 text-ink-muted">No shipments have been booked yet.</p>
          )}
          {!loading && !error && shipments.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {shipments.map((s, i) => (
                <motion.button
                  key={s.trackingNumber}
                  type="button"
                  onClick={() => { setSelected(s); setUpdateError('') }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className={`card block p-5 text-left transition hover:-translate-y-0.5 hover:shadow-glow ${
                    selected?.trackingNumber === s.trackingNumber ? 'ring-2 ring-brand-300' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`flex h-10 w-10 items-center justify-center rounded-full ${s.delivered ? 'bg-teal-50 text-teal-600' : 'bg-brand-50 text-brand-600'}`}>
                        {s.delivered ? <PackageCheck size={20} /> : <Truck size={20} />}
                      </span>
                      <div>
                        <div className="font-extrabold text-ink">{s.trackingNumber}</div>
                        <div className="flex items-center gap-1.5 text-sm text-ink-muted">
                          <MapPin size={13} className="text-brand-500" />
                          {s.from?.name} <ArrowRight size={12} /> {s.to?.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <StatusBadge delivered={s.delivered} status={s.status} />
                      {s.owner && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-xs text-ink-muted">
                          <User size={12} /> {s.owner.email}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ControlCard({ shipment, onSetStage, updating, error, onClose }) {
  return (
    <Reveal>
      <div className="card mt-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xl font-extrabold text-ink">{shipment.trackingNumber}</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin size={13} className="text-brand-500" />
              {shipment.from?.name} <ArrowRight size={12} /> {shipment.to?.name}
              <span className="ml-2">· {formatPrice(shipment.price, shipment.currency)}</span>
            </div>
            {shipment.owner && (
              <div className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                <User size={12} /> {shipment.owner.email}
              </div>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">Close</button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-grad" style={{ width: `${shipment.progress}%` }} />
          </div>
          <span className="text-xs font-medium text-ink-muted">{shipment.progress}%</span>
        </div>

        <p className="mt-6 label">Set stage (forward or backward)</p>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STAGES.map((stage, idx) => {
            const active = idx === shipment.currentIndex
            return (
              <button
                key={stage.key}
                type="button"
                disabled={updating || active}
                onClick={() => onSetStage(idx)}
                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition disabled:cursor-not-allowed ${
                  active
                    ? 'border-brand-400 bg-brand-50 text-brand-700'
                    : 'border-ink/10 bg-white text-ink-soft hover:border-brand-300 hover:bg-brand-50/40'
                }`}
              >
                <span><span className="text-ink-muted">{idx + 1}.</span> {stage.label}</span>
                {active && <span className="text-xs font-bold text-brand-600">current</span>}
              </button>
            )
          })}
        </div>

        {updating && (
          <div className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            <Loader2 size={16} className="animate-spin" /> Updating…
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <AlertCircle size={16} className="shrink-0" /> {error}
          </div>
        )}
      </div>
    </Reveal>
  )
}

const TINTS = {
  brand: 'bg-brand-50 text-brand-600',
  teal: 'bg-teal-50 text-teal-600',
  amber: 'bg-amber-50 text-amber-600',
}

function StatCard({ icon: Icon, tint = 'brand', label, value }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TINTS[tint]}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-ink">{value}</div>
        <div className="truncate text-sm text-ink-muted">{label}</div>
      </div>
    </div>
  )
}

function StatusBadge({ delivered, status }) {
  const label = delivered ? 'Delivered' : prettyStatus(status)
  return (
    <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${delivered ? 'bg-teal-50 text-teal-700' : 'bg-brand-50 text-brand-700'}`}>
      {label}
    </span>
  )
}

function prettyStatus(status) {
  if (!status) return 'In progress'
  return status.charAt(0).toUpperCase() + status.slice(1)
}
