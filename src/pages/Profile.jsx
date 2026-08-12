import { useState } from 'react'
import {
  User, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Save, KeyRound, ShieldCheck,
} from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ApiError, updateProfile, changePassword } from '../lib/api.js'

export default function Profile() {
  const { user, updateUser } = useAuth()

  return (
    <div className="bg-hero-grad min-h-[80vh]">
      <BackButton className="ml-4 mt-4" />
      <div className="container-x py-14 sm:py-20">
        <div className="mx-auto max-w-xl">
          <Reveal>
            <div className="text-center">
              <span className="chip mb-4 border border-brand-100 bg-white/70 text-brand-600">
                <ShieldCheck size={14} /> Account settings
              </span>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">Your profile</h1>
              <p className="mt-3 text-ink-muted">Update your name and password.</p>
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <ProfileCard user={user} onSaved={(u) => updateUser({ name: u.name })} />
          </Reveal>

          <Reveal delay={0.1}>
            <PasswordCard />
          </Reveal>
        </div>
      </div>
    </div>
  )
}

// --- Profile (name) card ----------------------------------------------------
function ProfileCard({ user, onSaved }) {
  const [name, setName] = useState(user?.name || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const dirty = name.trim() !== (user?.name || '').trim()

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    setSubmitting(true)
    try {
      const updated = await updateProfile({ name: name.trim() })
      onSaved(updated)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-8 p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <User size={18} className="text-brand-500" /> Profile
      </h2>

      <div className="mt-5 flex flex-col gap-4">
        <Field
          id="name" label="Name" icon={User} type="text"
          placeholder="Your name"
          value={name}
          onChange={(v) => { setName(v); setDone(false) }}
          autoComplete="name"
        />
        {/* Email is shown but not editable — it's the login key. */}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <div className="relative">
            <Mail size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="input cursor-not-allowed pl-11 opacity-60"
            />
          </div>
          <p className="mt-1.5 text-xs text-ink-muted">Email can’t be changed — it’s your sign-in.</p>
        </div>

        {error && <Banner kind="error" message={error} />}
        {done && !error && <Banner kind="success" message="Profile updated." />}

        <button
          type="submit"
          className="btn-primary mt-1 text-base disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || !dirty}
        >
          {submitting ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : <><Save size={18} /> Save changes</>}
        </button>
      </div>
    </form>
  )
}

// --- Password card ----------------------------------------------------------
function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNext, setShowNext] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const strength = STRENGTH[scorePassword(next)]
  const canSubmit = current.length > 0 && next.length >= 6

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setDone(false)
    if (next.length < 6) {
      setError('New password must be at least 6 characters.')
      return
    }
    setSubmitting(true)
    try {
      await changePassword({ currentPassword: current, newPassword: next })
      setDone(true)
      setCurrent('')
      setNext('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change your password. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="card mt-6 p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <KeyRound size={18} className="text-brand-500" /> Password
      </h2>

      <div className="mt-5 flex flex-col gap-4">
        <Field
          id="current-password" label="Current password" icon={Lock}
          type={showCurrent ? 'text' : 'password'}
          placeholder="Your current password"
          value={current}
          onChange={(v) => { setCurrent(v); setDone(false) }}
          autoComplete="current-password"
          trailing={<EyeToggle show={showCurrent} onToggle={() => setShowCurrent((v) => !v)} />}
        />
        <div>
          <Field
            id="new-password" label="New password" icon={Lock}
            type={showNext ? 'text' : 'password'}
            placeholder="At least 6 characters"
            value={next}
            onChange={(v) => { setNext(v); setDone(false) }}
            autoComplete="new-password"
            trailing={<EyeToggle show={showNext} onToggle={() => setShowNext((v) => !v)} />}
          />
          {next && (
            <div className="mt-2">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${i < strength.cells ? strength.bar : 'bg-ink/10'}`}
                  />
                ))}
              </div>
              <p className={`mt-1.5 text-xs font-semibold ${strength.text}`}>Password strength: {strength.label}</p>
            </div>
          )}
        </div>

        {error && <Banner kind="error" message={error} />}
        {done && !error && <Banner kind="success" message="Password updated." />}

        <button
          type="submit"
          className="btn-primary mt-1 text-base disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || !canSubmit}
        >
          {submitting ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : <><CheckCircle2 size={18} /> Update password</>}
        </button>
      </div>
    </form>
  )
}

// --- Shared UI bits (mirrors Login.jsx's Field/strength idiom) --------------

function scorePassword(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4)
}

const STRENGTH = [
  { label: 'Too short', bar: 'bg-red-400', text: 'text-red-600', cells: 1 },
  { label: 'Weak', bar: 'bg-orange-400', text: 'text-orange-600', cells: 1 },
  { label: 'Fair', bar: 'bg-amber-400', text: 'text-amber-600', cells: 2 },
  { label: 'Good', bar: 'bg-lime-500', text: 'text-lime-600', cells: 3 },
  { label: 'Strong', bar: 'bg-teal-500', text: 'text-teal-600', cells: 4 },
]

function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted transition hover:text-ink"
      tabIndex={-1}
    >
      {show ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
}

function Field({ id, label, icon: Icon, type, placeholder, value, onChange, autoComplete, trailing }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`input pl-11 ${trailing ? 'pr-12' : ''}`}
        />
        {trailing}
      </div>
    </div>
  )
}

function Banner({ kind, message }) {
  const isError = kind === 'error'
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${
        isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-teal-200 bg-teal-50 text-teal-700'
      }`}
    >
      {isError ? <AlertCircle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" />}
      {message}
    </div>
  )
}
