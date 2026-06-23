import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Search, MapPin, PackageCheck, Truck, CheckCircle2, Circle, Copy, Loader2, AlertCircle, ImageIcon,
} from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import { fetchTracking } from '../lib/api.js'

export default function Track() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [input, setInput] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notFound, setNotFound] = useState(false)

  async function search(value) {
    const num = (value ?? input).trim()
    setError('')
    setNotFound(false)
    if (!num) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const tracking = await fetchTracking(num)
      if (tracking) {
        setResult(tracking)
      } else {
        setResult(null)
        setNotFound(true)
      }
    } catch (err) {
      setResult(null)
      setError(err.message || 'Something went wrong while looking that up.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-search when arriving with ?number=... (e.g. from the booking success screen).
  const lastQueried = useRef(null)
  useEffect(() => {
    const num = searchParams.get('number')
    if (num && num !== lastQueried.current) {
      lastQueried.current = num
      setInput(num)
      search(num)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  function onSubmit(e) {
    e.preventDefault()
    const num = input.trim()
    if (num) setSearchParams({ number: num })
    search()
  }

  const currentStage = result?.timeline?.[result.currentIndex]
  const statusLabel = result?.delivered ? 'Delivered' : currentStage?.label || 'In progress'

  return (
    <div className="bg-hero-grad min-h-[70vh]">
      <BackButton className="ml-4 mt-4" />
      <div className="container-x py-14 sm:py-20">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip mb-4 border border-teal-100 bg-white/70 text-teal-600">
              <MapPin size={14} /> Live tracking
            </span>
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Track your shipment</h1>
            <p className="mt-3 text-ink-muted">
              Enter your DropOff tracking number to see exactly where your parcel is.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 max-w-2xl">
          <Reveal delay={0.05}>
            <form
              onSubmit={onSubmit}
              className="card flex flex-col gap-3 p-3 sm:flex-row"
            >
              <div className="flex flex-1 items-center gap-2 px-3">
                <Search size={18} className="text-ink-muted" />
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. DROP-7X4K-2291"
                  className="w-full bg-transparent py-3 text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Tracking…
                  </>
                ) : (
                  <>
                    Track <Search size={16} />
                  </>
                )}
              </button>
            </form>
          </Reveal>

          {/* Error */}
          {error && (
            <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              <AlertCircle size={16} className="shrink-0" /> {error}
            </div>
          )}

          {/* Not found */}
          {notFound && !loading && (
            <p className="mt-8 text-center text-ink-muted">
              No shipment found for that tracking number. Double-check it and try again.
            </p>
          )}

          {/* Result */}
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <div className="card overflow-hidden">
                {/* Header */}
                <div className="border-b border-ink/5 bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-ink-muted">
                        Tracking number
                        <button
                          onClick={() => navigator.clipboard?.writeText(result.trackingNumber)}
                          className="text-ink-muted hover:text-brand-600"
                          title="Copy"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="text-xl font-extrabold text-ink">{result.trackingNumber}</div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${
                        result.delivered
                          ? 'bg-teal-50 text-teal-700'
                          : 'bg-brand-50 text-brand-700'
                      }`}
                    >
                      {result.delivered ? <PackageCheck size={16} /> : <Truck size={16} />}
                      {statusLabel}
                    </span>
                  </div>

                  {/* Route + progress */}
                  <div className="mt-5 flex items-center gap-3 text-sm font-semibold text-ink">
                    <MapPin size={16} className="text-brand-500" /> {result.origin}
                    <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-brand-grad"
                        initial={{ width: 0 }}
                        animate={{ width: `${result.progress}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                      />
                    </div>
                    {result.destination} <MapPin size={16} className="text-teal-500" />
                  </div>
                </div>

                {/* Parcel photo (if the sender added one) */}
                {result.photo && (
                  <div className="border-b border-ink/5 bg-cloud/60 p-6">
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink-soft">
                      <ImageIcon size={15} className="text-brand-500" /> Photo of contents
                    </div>
                    <a href={result.photo} target="_blank" rel="noreferrer" title="Open full size">
                      <img
                        src={result.photo}
                        alt="Photo of the shipment contents"
                        className="max-h-72 w-full rounded-2xl border border-ink/10 object-contain bg-white"
                      />
                    </a>
                  </div>
                )}

                {/* Timeline */}
                <ol className="p-6">
                  {result.timeline.map((ev, i) => (
                    <li key={ev.key} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full ${
                            ev.current
                              ? 'bg-brand-500 text-white shadow-glow'
                              : ev.done
                                ? 'bg-teal-500 text-white'
                                : 'bg-ink/10 text-ink-muted'
                          }`}
                        >
                          {ev.done ? <CheckCircle2 size={16} /> : <Circle size={14} />}
                        </span>
                        {i < result.timeline.length - 1 && (
                          <span
                            className={`my-1 w-0.5 flex-1 ${ev.done ? 'bg-teal-300' : 'bg-ink/10'}`}
                            style={{ minHeight: 28 }}
                          />
                        )}
                      </div>
                      <div className={`pb-6 ${ev.done ? '' : 'opacity-50'}`}>
                        <div className="font-bold text-ink">{ev.label}</div>
                        <div className="text-sm text-ink-muted">{ev.detail}</div>
                        <div className="mt-0.5 text-xs font-medium text-ink-muted">
                          {ev.place}
                          {ev.current && !result.delivered && ' · Current status'}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
