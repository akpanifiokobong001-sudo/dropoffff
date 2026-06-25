import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, ArrowLeft, Package, Box, FileText, Shirt, Laptop, Gift,
  PlaneTakeoff, Sparkles, CheckCircle2, RefreshCw, Loader2, AlertCircle, Copy,
  Camera, ImagePlus, X, User, MapPin, Phone, Building2,
} from 'lucide-react'
import CountrySelect from '../components/CountrySelect.jsx'
import StateSelect from '../components/StateSelect.jsx'
import StepIndicator from '../components/StepIndicator.jsx'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import { formatPrice, SERVICES } from '../lib/pricing.js'
import { fetchQuotes, createShipment } from '../lib/api.js'
import { compressImage } from '../lib/image.js'
import { countryByCode } from '../data/countries.js'
import { hasStates } from '../data/states.js'

const STEPS = ['Route', 'Package', 'Details', 'Quote']

// Empty sender/recipient contact. Both parties need the same fields so the
// courier knows who to collect from and who to deliver to.
const EMPTY_CONTACT = { name: '', address: '', city: '', phone: '' }

const PARCEL_TYPES = [
  { key: 'documents', label: 'Documents', icon: FileText, weight: 0.5 },
  { key: 'clothing', label: 'Clothing', icon: Shirt, weight: 2 },
  { key: 'electronics', label: 'Electronics', icon: Laptop, weight: 3 },
  { key: 'gift', label: 'Gift / Personal', icon: Gift, weight: 1.5 },
  { key: 'box', label: 'Standard box', icon: Box, weight: 5 },
  { key: 'other', label: 'Other', icon: Package, weight: 2 },
]

export default function Send() {
  const [step, setStep] = useState(0)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  // Origin/destination state (subdivision) names. Reset whenever the country
  // changes so a stale state can never travel with a different country.
  const [fromState, setFromState] = useState('')
  const [toState, setToState] = useState('')
  const [parcelType, setParcelType] = useState('box')
  const [weight, setWeight] = useState(2)
  const [service, setService] = useState('express')

  // Who's sending and who's receiving — name, address, city, phone for each.
  const [sender, setSender] = useState(EMPTY_CONTACT)
  const [recipient, setRecipient] = useState(EMPTY_CONTACT)
  const [detailsError, setDetailsError] = useState('')

  // Optional photo of the items being sent — compressed client-side to a JPEG
  // data URL before it travels with the shipment payload.
  const [photo, setPhoto] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  // Quotes come from the backend (POST /api/quotes) when the user reaches the Quote step.
  const [quotes, setQuotes] = useState([])
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState('')

  // Booking (POST /api/shipments) state + the created shipment on success.
  const [booking, setBooking] = useState(false)
  const [bookError, setBookError] = useState('')
  const [shipment, setShipment] = useState(null)

  // A state is required only for countries that actually have a subdivision list.
  const needFromState = hasStates(from)
  const needToState = hasStates(to)
  const canNext0 = from && to && (!needFromState || fromState) && (!needToState || toState)
  const selectedQuote = quotes.find((q) => q.service === service)

  // A contact is complete when name, address, city, and phone are all filled.
  const contactComplete = (c) =>
    c.name.trim() && c.address.trim() && c.city.trim() && c.phone.trim()
  const canNextDetails = contactComplete(sender) && contactComplete(recipient)

  // Field setters that merge one key into sender/recipient.
  const setSenderField = (key, val) => setSender((c) => ({ ...c, [key]: val }))
  const setRecipientField = (key, val) => setRecipient((c) => ({ ...c, [key]: val }))

  // Changing a country invalidates any state picked for it.
  function changeFrom(code) {
    setFrom(code)
    setFromState('')
  }
  function changeTo(code) {
    setTo(code)
    setToState('')
  }

  // Fetch quotes for the chosen route/weight, then advance to the Quote step.
  async function loadQuotes() {
    setQuoteLoading(true)
    setQuoteError('')
    try {
      const result = await fetchQuotes({
        fromCode: from,
        toCode: to,
        fromState: fromState || undefined,
        toState: toState || undefined,
        weightKg: Number(weight) || 0,
      })
      setQuotes(result)
      // Keep the current selection if still present, else default to express.
      if (!result.some((q) => q.service === service)) setService('express')
      setStep(3)
    } catch (err) {
      setQuoteError(err.message || 'Could not load quotes. Please try again.')
    } finally {
      setQuoteLoading(false)
    }
  }

  // Compress the chosen file and stash the resulting data URL. Errors surface
  // inline; the rest of the flow works fine without a photo.
  async function onPhotoChange(e) {
    const file = e.target.files?.[0]
    // Reset the input so picking the same file again still fires onChange.
    e.target.value = ''
    if (!file) return
    setPhotoError('')
    setPhotoLoading(true)
    try {
      const dataUrl = await compressImage(file)
      setPhoto(dataUrl)
    } catch (err) {
      setPhoto(null)
      setPhotoError(err.message || 'Could not add that photo. Please try another.')
    } finally {
      setPhotoLoading(false)
    }
  }

  function removePhoto() {
    setPhoto(null)
    setPhotoError('')
  }

  async function book() {
    if (!selectedQuote) return
    setBooking(true)
    setBookError('')
    try {
      const created = await createShipment({
        fromCode: from,
        toCode: to,
        fromState: fromState || undefined,
        toState: toState || undefined,
        weightKg: Number(weight) || 0,
        service,
        parcelType,
        sender,
        recipient,
        photo: photo || undefined,
      })
      setShipment(created)
    } catch (err) {
      setBookError(err.message || 'Could not book the shipment. Please try again.')
    } finally {
      setBooking(false)
    }
  }

  function reset() {
    setStep(0); setFrom(''); setTo(''); setFromState(''); setToState(''); setParcelType('box'); setWeight(2); setService('express')
    setQuotes([]); setQuoteError(''); setBookError(''); setShipment(null)
    setPhoto(null); setPhotoError(''); setPhotoLoading(false)
    setSender(EMPTY_CONTACT); setRecipient(EMPTY_CONTACT); setDetailsError('')
  }

  return (
    <div className="bg-hero-grad">
      <div className="container-x py-14 sm:py-20">
        <BackButton />
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip mb-4 border border-brand-100 bg-white/70 text-brand-600">
              <PlaneTakeoff size={14} /> Instant quote
            </span>
            <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Send a package</h1>
            <p className="mt-3 text-ink-muted">
              Get a live price to ship anywhere in the world — in under a minute.
            </p>
          </div>
        </Reveal>

        <div className="mx-auto mt-10 max-w-3xl">
          <div className="card p-6 sm:p-9">
            <StepIndicator steps={STEPS} current={step} />

            <div className="mt-9">
              <AnimatePresence mode="wait">
                {/* STEP 1 — ROUTE */}
                {step === 0 && (
                  <StepWrap key="route">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="space-y-4">
                        <CountrySelect id="from" label="Ship from" value={from} onChange={changeFrom} placeholder="Origin country" />
                        {needFromState && (
                          <StateSelect
                            id="from-state"
                            label="Origin state / province"
                            countryCode={from}
                            value={fromState}
                            onChange={setFromState}
                            placeholder="Select origin state"
                          />
                        )}
                      </div>
                      <div className="space-y-4">
                        <CountrySelect id="to" label="Ship to" value={to} onChange={changeTo} placeholder="Destination country" />
                        {needToState && (
                          <StateSelect
                            id="to-state"
                            label="Destination state / province"
                            countryCode={to}
                            value={toState}
                            onChange={setToState}
                            placeholder="Select destination state"
                          />
                        )}
                      </div>
                    </div>
                    {canNext0 && (
                      <div className="mt-5 flex flex-col items-center justify-center gap-2 rounded-2xl bg-cloud px-4 py-3 text-sm font-semibold text-ink sm:flex-row sm:gap-3">
                        <span className="flex items-center gap-1.5">
                          <span className="text-xl">{countryByCode[from].flag}</span>
                          {fromState ? `${fromState}, ${countryByCode[from].name}` : countryByCode[from].name}
                        </span>
                        <ArrowRight size={16} className="text-brand-500" />
                        <span className="flex items-center gap-1.5">
                          <span className="text-xl">{countryByCode[to].flag}</span>
                          {toState ? `${toState}, ${countryByCode[to].name}` : countryByCode[to].name}
                        </span>
                      </div>
                    )}
                    <Nav onNext={() => setStep(1)} nextDisabled={!canNext0} />
                  </StepWrap>
                )}

                {/* STEP 2 — PACKAGE */}
                {step === 1 && (
                  <StepWrap key="package">
                    <p className="label">What are you sending?</p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {PARCEL_TYPES.map((p) => {
                        const active = parcelType === p.key
                        return (
                          <button
                            key={p.key}
                            type="button"
                            onClick={() => { setParcelType(p.key); setWeight(p.weight) }}
                            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition ${
                              active
                                ? 'border-brand-400 bg-brand-50 text-brand-700 shadow-glow'
                                : 'border-ink/10 bg-white text-ink-soft hover:border-ink/20'
                            }`}
                          >
                            <p.icon size={22} />
                            {p.label}
                          </button>
                        )
                      })}
                    </div>

                    <div className="mt-7">
                      <label htmlFor="weight" className="label">
                        Approximate weight: <span className="text-brand-600">{weight} kg</span>
                      </label>
                      <input
                        id="weight"
                        type="range"
                        min="0.5"
                        max="30"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        className="w-full accent-brand-500"
                      />
                      <div className="mt-1 flex justify-between text-xs text-ink-muted">
                        <span>0.5 kg</span>
                        <span>30 kg</span>
                      </div>
                    </div>

                    {/* Optional photo of the items */}
                    <div className="mt-7">
                      <p className="label">
                        Add a photo of your items <span className="font-normal text-ink-muted">(optional)</span>
                      </p>
                      <PhotoUpload
                        photo={photo}
                        loading={photoLoading}
                        error={photoError}
                        onChange={onPhotoChange}
                        onRemove={removePhoto}
                      />
                    </div>

                    <Nav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continue" />
                  </StepWrap>
                )}

                {/* STEP 3 — DETAILS (sender + recipient) */}
                {step === 2 && (
                  <StepWrap key="details">
                    <p className="label">Who's sending and receiving this parcel?</p>
                    <p className="mb-5 text-sm text-ink-muted">
                      We use these details for pickup and delivery. All fields are required.
                    </p>

                    <div className="grid gap-6 sm:grid-cols-2">
                      <ContactFields
                        title="Sender"
                        accent="brand"
                        contact={sender}
                        onField={setSenderField}
                      />
                      <ContactFields
                        title="Recipient"
                        accent="teal"
                        contact={recipient}
                        onField={setRecipientField}
                      />
                    </div>

                    {detailsError && <ErrorNote message={detailsError} />}
                    {quoteError && <ErrorNote message={quoteError} />}
                    <Nav
                      onBack={() => setStep(1)}
                      onNext={() => {
                        if (!canNextDetails) {
                          setDetailsError('Please fill in every field for both the sender and the recipient.')
                          return
                        }
                        setDetailsError('')
                        loadQuotes()
                      }}
                      loading={quoteLoading}
                      nextLabel="Get quote"
                    />
                  </StepWrap>
                )}

                {/* STEP 4 — QUOTE (or success screen once booked) */}
                {step === 3 && shipment && (
                  <StepWrap key="booked">
                    <Success shipment={shipment} onReset={reset} />
                  </StepWrap>
                )}

                {step === 3 && !shipment && (
                  <StepWrap key="quote">
                    <div className="mb-6 flex items-center gap-2 rounded-2xl bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-700">
                      <Sparkles size={16} /> Here’s your instant estimate
                    </div>

                    <div className="grid gap-4">
                      {quotes.map((q) => {
                        const svc = SERVICES[q.service]
                        const active = service === q.service
                        return (
                          <button
                            key={q.service}
                            type="button"
                            onClick={() => setService(q.service)}
                            className={`flex items-center justify-between rounded-2xl border p-5 text-left transition ${
                              active
                                ? 'border-brand-400 bg-brand-50/60 shadow-glow'
                                : 'border-ink/10 bg-white hover:border-ink/20'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-ink">{svc.name}</span>
                                {q.service === 'express' && (
                                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                                    Popular
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-ink-muted">{svc.tagline}</div>
                              <div className="mt-1 text-sm font-medium text-teal-600">
                                Delivery in ~{q.etaDays} business day{q.etaDays > 1 ? 's' : ''}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-extrabold text-ink">
                                {formatPrice(q.price)}
                              </div>
                              <div className="text-xs text-ink-muted">all-in estimate</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>

                    {/* Summary */}
                    {selectedQuote && (
                      <div className="mt-6 rounded-2xl bg-cloud p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                          <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                            <span className="text-lg">{countryByCode[from].flag}</span>
                            {fromState ? `${fromState}, ${countryByCode[from].name}` : countryByCode[from].name}
                            <ArrowRight size={14} className="text-brand-500" />
                            <span className="text-lg">{countryByCode[to].flag}</span>
                            {toState ? `${toState}, ${countryByCode[to].name}` : countryByCode[to].name}
                          </span>
                          <span className="text-ink-muted">{weight} kg · {selectedQuote.serviceName}</span>
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-ink-soft sm:grid-cols-5">
                          <Bd label="Base" v={selectedQuote.breakdown.base} />
                          <Bd label="Distance" v={selectedQuote.breakdown.distance} />
                          <Bd label="Weight" v={selectedQuote.breakdown.weight} />
                          {selectedQuote.breakdown.interState > 0 && (
                            <Bd label="Inter-state" v={selectedQuote.breakdown.interState} />
                          )}
                          <Bd label="Fees" v={selectedQuote.breakdown.fees} />
                        </div>
                      </div>
                    )}

                    {bookError && <ErrorNote message={bookError} />}

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        className="btn-primary flex-1 text-base disabled:cursor-not-allowed disabled:opacity-60"
                        onClick={book}
                        disabled={booking || !selectedQuote}
                      >
                        {booking ? (
                          <>
                            <Loader2 size={18} className="animate-spin" /> Booking…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={18} /> Book this shipment
                          </>
                        )}
                      </button>
                      <button type="button" onClick={reset} className="btn-secondary" disabled={booking}>
                        <RefreshCw size={16} /> New quote
                      </button>
                    </div>
                    <div className="mt-4 flex justify-start">
                      <button onClick={() => setStep(2)} className="btn-ghost text-sm" disabled={booking}>
                        <ArrowLeft size={16} /> Back
                      </button>
                    </div>
                  </StepWrap>
                )}
              </AnimatePresence>
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Prices are demo estimates. Want to compare service tiers?{' '}
            <Link to="/pricing" className="font-semibold text-brand-600 hover:underline">
              See pricing
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function StepWrap({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  )
}

function Nav({ onBack, onNext, nextDisabled, loading, nextLabel = 'Continue' }) {
  return (
    <div className="mt-8 flex items-center justify-between">
      {onBack ? (
        <button onClick={onBack} className="btn-ghost text-sm" disabled={loading}>
          <ArrowLeft size={16} /> Back
        </button>
      ) : (
        <span />
      )}
      <button
        onClick={onNext}
        disabled={nextDisabled || loading}
        className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Getting quote…
          </>
        ) : (
          <>
            {nextLabel} <ArrowRight size={16} />
          </>
        )}
      </button>
    </div>
  )
}

// Photo picker with preview. Shows a dashed dropzone-style button until a photo
// is chosen, then a thumbnail with a remove control. Accepts camera capture on
// mobile via the `capture` hint.
function PhotoUpload({ photo, loading, error, onChange, onRemove }) {
  if (photo) {
    return (
      <div className="mt-2">
        <div className="relative inline-block">
          <img
            src={photo}
            alt="Parcel contents preview"
            className="h-40 w-40 rounded-2xl border border-ink/10 object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white shadow-md transition hover:bg-ink/80"
            title="Remove photo"
          >
            <X size={15} />
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          This photo will be saved with your shipment and shown when tracking it.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-7 text-center transition ${
          loading
            ? 'border-brand-300 bg-brand-50/50'
            : 'border-ink/20 bg-white hover:border-brand-300 hover:bg-brand-50/40'
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={onChange}
          disabled={loading}
          className="sr-only"
        />
        {loading ? (
          <>
            <Loader2 size={22} className="animate-spin text-brand-500" />
            <span className="text-sm font-semibold text-ink-soft">Processing photo…</span>
          </>
        ) : (
          <>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <ImagePlus size={22} />
            </span>
            <span className="text-sm font-semibold text-ink">
              <span className="inline-flex items-center gap-1 text-brand-600">
                <Camera size={14} /> Take or upload a photo
              </span>
            </span>
            <span className="text-xs text-ink-muted">JPEG, PNG, or WebP — automatically resized</span>
          </>
        )}
      </label>
      {error && (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-red-600">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}

function ErrorNote({ message }) {
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      <AlertCircle size={16} className="shrink-0" /> {message}
    </div>
  )
}

// Sender / recipient contact fields (name, address, city, phone). `accent`
// tints the header so the two columns read as distinct parties.
function ContactFields({ title, accent, contact, onField }) {
  const tint = accent === 'teal' ? 'text-teal-600' : 'text-brand-600'
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className={`mb-4 flex items-center gap-2 text-sm font-bold ${tint}`}>
        <User size={16} /> {title}
      </div>
      <div className="space-y-3">
        <Field icon={User} placeholder="Full name"
          value={contact.name} onChange={(v) => onField('name', v)} autoComplete="name" />
        <Field icon={MapPin} placeholder="Home address"
          value={contact.address} onChange={(v) => onField('address', v)} autoComplete="street-address" />
        <Field icon={Building2} placeholder="City"
          value={contact.city} onChange={(v) => onField('city', v)} autoComplete="address-level2" />
        <Field icon={Phone} placeholder="Phone number" type="tel"
          value={contact.phone} onChange={(v) => onField('phone', v)} autoComplete="tel" />
      </div>
    </div>
  )
}

// A single labelled text input with a leading icon.
function Field({ icon: Icon, placeholder, value, onChange, type = 'text', autoComplete }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 focus-within:border-brand-300">
      <Icon size={16} className="shrink-0 text-ink-muted" />
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-ink-muted"
      />
    </div>
  )
}

// Shown after a shipment is successfully created — surfaces the tracking number
// and a link to the Track page.
function Success({ shipment, onReset }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600">
        <CheckCircle2 size={36} />
      </div>
      <h2 className="text-2xl font-extrabold text-ink">Shipment booked!</h2>
      <p className="mt-2 text-ink-muted">
        Your parcel is registered. Keep this tracking number to follow its journey.
      </p>

      <div className="mx-auto mt-6 flex max-w-sm items-center justify-between gap-3 rounded-2xl bg-cloud px-5 py-4">
        <div className="text-left">
          <div className="text-xs text-ink-muted">Tracking number</div>
          <div className="text-xl font-extrabold tracking-wide text-ink">{shipment.trackingNumber}</div>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(shipment.trackingNumber)}
          className="text-ink-muted hover:text-brand-600"
          title="Copy tracking number"
        >
          <Copy size={18} />
        </button>
      </div>

      <div className="mt-4 text-sm text-ink-muted">
        {shipment.from?.name} → {shipment.to?.name} · {formatPrice(shipment.price, shipment.currency)} ·
        {' '}~{shipment.etaDays} day{shipment.etaDays > 1 ? 's' : ''}
      </div>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Link to={`/track?number=${encodeURIComponent(shipment.trackingNumber)}`} className="btn-primary">
          Track this shipment <ArrowRight size={16} />
        </Link>
        <button type="button" onClick={onReset} className="btn-secondary">
          <RefreshCw size={16} /> Send another
        </button>
      </div>
    </div>
  )
}

function Bd({ label, v }) {
  return (
    <div className="rounded-xl bg-white px-3 py-2">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="font-semibold text-ink">{formatPrice(v)}</div>
    </div>
  )
}
