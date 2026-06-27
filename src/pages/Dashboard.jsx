import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Package, PackageCheck, Truck, ArrowRight, Plus, Loader2, AlertCircle, MapPin,
} from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { fetchMyShipments } from '../lib/api.js'
import { formatPrice } from '../lib/pricing.js'

export default function Dashboard() {
  const { user } = useAuth()
  const [shipments, setShipments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const list = await fetchMyShipments()
        if (!cancelled) setShipments(list)
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your shipments.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const firstName = (user?.name || '').trim().split(' ')[0]

  return (
    <div className="bg-hero-grad min-h-[80vh]">
      <BackButton className="ml-4 mt-4" />
      <div className="container-x py-14 sm:py-20">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="chip mb-3 border border-brand-100 bg-white/70 text-brand-600">
                <Package size={14} /> Your shipments
              </span>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
                {firstName ? `Hi, ${firstName}` : 'Welcome back'}
              </h1>
              <p className="mt-2 text-ink-muted">
                Every parcel you’ve booked while signed in, in one place.
              </p>
            </div>
            <Link to="/send" className="btn-primary">
              <Plus size={16} /> Send a package
            </Link>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={28} className="animate-spin text-brand-500" />
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {!loading && !error && shipments.length === 0 && (
            <div className="card flex flex-col items-center gap-4 p-10 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <Package size={32} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-ink">No shipments yet</h2>
                <p className="mt-1 text-ink-muted">Book your first package and it’ll show up here.</p>
              </div>
              <Link to="/send" className="btn-primary">
                <Plus size={16} /> Send a package
              </Link>
            </div>
          )}

          {!loading && !error && shipments.length > 0 && (
            <div className="flex flex-col gap-4">
              {shipments.map((s, i) => (
                <motion.div
                  key={s.trackingNumber}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.04, 0.3) }}
                >
                  <Link
                    to={`/track?number=${encodeURIComponent(s.trackingNumber)}`}
                    className="card block p-5 transition hover:-translate-y-0.5 hover:shadow-glow"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-10 w-10 items-center justify-center rounded-full ${
                            s.delivered ? 'bg-teal-50 text-teal-600' : 'bg-brand-50 text-brand-600'
                          }`}
                        >
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
                        <div className="mt-1 text-sm font-semibold text-ink">
                          {formatPrice(s.price, s.currency)}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                        <div
                          className="absolute inset-y-0 left-0 rounded-full bg-brand-grad"
                          style={{ width: `${s.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-ink-muted">
                        {s.delivered ? 'Delivered' : `${s.progress}%`}
                      </span>
                    </div>

                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ delivered, status }) {
  const label = delivered ? 'Delivered' : prettyStatus(status)
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${
        delivered ? 'bg-teal-50 text-teal-700' : 'bg-brand-50 text-brand-700'
      }`}
    >
      {label}
    </span>
  )
}

function prettyStatus(status) {
  if (!status) return 'In progress'
  return status.charAt(0).toUpperCase() + status.slice(1)
}
