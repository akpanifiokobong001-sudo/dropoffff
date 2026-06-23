import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogIn, UserPlus, Loader2, AlertCircle, Mail, Lock, User, Eye, EyeOff } from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import WelcomeModal from '../components/WelcomeModal.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { ApiError } from '../lib/api.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Rough password strength score (0–4) for the register tab's live hint.
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

export default function Login() {
  const { login, register, logoutReason, clearLogoutReason } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromPath = searchParams.get('from')
  const redirectTo = fromPath || '/dashboard'

  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('') // server / network errors (banner)
  const [fieldErrors, setFieldErrors] = useState({}) // { email, password } (inline)
  const [submitting, setSubmitting] = useState(false)
  // After a successful auth we show a welcome/thank-you modal instead of
  // navigating immediately; the OK button does the navigation.
  const [welcome, setWelcome] = useState(null) // { isNew, user } | null
  const emailRef = useRef(null)

  const isRegister = mode === 'register'

  // Autofocus the email field on mount so the user can start typing immediately.
  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  function switchMode(next) {
    setMode(next)
    setError('')
    setFieldErrors({})
  }

  function validate() {
    const errs = {}
    if (!email.trim() || !EMAIL_RE.test(email)) {
      errs.email = 'Please enter a valid email address.'
    }
    if (password.length < 6) {
      errs.password = 'Password must be at least 6 characters.'
    }
    return errs
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    clearLogoutReason()

    // Client-side validation (server enforces these too).
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})

    setSubmitting(true)
    try {
      const u = isRegister
        ? await register({ email: email.trim(), password, name: name.trim() })
        : await login({ email: email.trim(), password })
      // Show the welcome/thank-you modal; navigation happens when the user
      // clicks OK (see onWelcomeOk).
      setWelcome({ isNew: isRegister, user: u })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // OK on the welcome modal → route by role: admins to the admin panel, regular
  // users to wherever they were headed (or the dashboard).
  function onWelcomeOk() {
    const dest = welcome?.user?.role === 'admin' ? '/admin' : redirectTo
    setWelcome(null)
    navigate(dest, { replace: true })
  }

  const strength = STRENGTH[scorePassword(password)]

  return (
    <div className="bg-hero-grad min-h-[80vh]">
      <WelcomeModal
        open={!!welcome}
        isNew={welcome?.isNew}
        name={welcome?.user?.name}
        onOk={onWelcomeOk}
      />
      <div className="container-x py-14 sm:py-20">
        <div className="mx-auto max-w-md">
          <Reveal>
            <div className="text-center">
              <span className="chip mb-4 border border-brand-100 bg-white/70 text-brand-600">
                {isRegister ? <UserPlus size={14} /> : <LogIn size={14} />}
                {isRegister ? 'Create account' : 'Welcome back'}
              </span>
              <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">
                {isRegister ? 'Join DropOff' : 'Sign in'}
              </h1>
              <p className="mt-3 text-ink-muted">
                {isRegister
                  ? 'Create an account to save and track all your shipments.'
                  : 'Sign in to see your shipments and track them in one place.'}
              </p>
              {fromPath && (
                <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-2.5 text-sm font-medium text-brand-700">
                  <Lock size={15} className="shrink-0" /> Sign in to continue to that page.
                </div>
              )}
            </div>
          </Reveal>

          <Reveal delay={0.05}>
            <div className="card mt-8 p-6 sm:p-8">
              {/* Mode toggle */}
              <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-cloud p-1">
                <ToggleBtn active={!isRegister} onClick={() => switchMode('login')}>Sign in</ToggleBtn>
                <ToggleBtn active={isRegister} onClick={() => switchMode('register')}>Create account</ToggleBtn>
              </div>

              <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
                <AnimatePresence initial={false}>
                  {isRegister && (
                    <motion.div
                      key="name"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Field
                        id="name" label="Name" icon={User} type="text"
                        placeholder="Your name (optional)"
                        value={name} onChange={setName} autoComplete="name"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field
                  id="email" label="Email" icon={Mail} type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(v) => { setEmail(v); if (fieldErrors.email) setFieldErrors((e) => ({ ...e, email: undefined })) }}
                  autoComplete="email" required
                  inputRef={emailRef}
                  error={fieldErrors.email}
                />
                <div>
                  <Field
                    id="password" label="Password" icon={Lock}
                    type={showPassword ? 'text' : 'password'}
                    placeholder={isRegister ? 'At least 6 characters' : 'Your password'}
                    value={password}
                    onChange={(v) => { setPassword(v); if (fieldErrors.password) setFieldErrors((e) => ({ ...e, password: undefined })) }}
                    autoComplete={isRegister ? 'new-password' : 'current-password'} required
                    error={fieldErrors.password}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted transition hover:text-ink"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                  />
                  {/* Live strength meter — register tab only */}
                  {isRegister && password && (
                    <div className="mt-2">
                      <div className="flex gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i < strength.cells ? strength.bar : 'bg-ink/10'
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`mt-1.5 text-xs font-semibold ${strength.text}`}>
                        Password strength: {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {logoutReason && !error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                    <AlertCircle size={16} className="shrink-0" /> {logoutReason}
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                  </div>
                )}

                <button type="submit" className="btn-primary mt-1 text-base disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> {isRegister ? 'Creating account…' : 'Signing in…'}
                    </>
                  ) : isRegister ? (
                    <>
                      <UserPlus size={18} /> Create account
                    </>
                  ) : (
                    <>
                      <LogIn size={18} /> Sign in
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-ink-muted">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  type="button"
                  onClick={() => switchMode(isRegister ? 'login' : 'register')}
                  className="font-semibold text-brand-600 hover:underline"
                >
                  {isRegister ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </div>
          </Reveal>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Just looking?{' '}
            <Link to="/send" className="font-semibold text-brand-600 hover:underline">
              Get an instant quote
            </Link>{' '}
            — no account needed.
          </p>
        </div>
      </div>
    </div>
  )
}

function ToggleBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-2.5 text-sm font-semibold transition ${
        active ? 'bg-white text-ink shadow-card' : 'text-ink-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ id, label, icon: Icon, type, placeholder, value, onChange, autoComplete, required, inputRef, error, trailing }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          id={id}
          ref={inputRef}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`input pl-11 ${trailing ? 'pr-12' : ''} ${error ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle size={13} className="shrink-0" /> {error}
        </p>
      )}
    </div>
  )
}
