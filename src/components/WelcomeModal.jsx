import { motion, AnimatePresence } from 'framer-motion'
import { PartyPopper, Hand } from 'lucide-react'

// A small centered modal shown right after a successful login or registration.
// New users get a "thank you" message; returning users get a "welcome back".
// A single OK button continues to the destination (dashboard or admin page).
export default function WelcomeModal({ open, isNew, name, onOk }) {
  const firstName = (name || '').trim().split(' ')[0]
  const title = isNew ? 'Thank you for joining DropOff!' : 'Welcome back!'
  const message = isNew
    ? 'Your account is ready. Let’s get your first shipment moving.'
    : firstName
      ? `Good to see you again, ${firstName}. Here’s your dashboard.`
      : 'Good to see you again. Here’s your dashboard.'
  const Icon = isNew ? PartyPopper : Hand

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="welcome-title"
            className="card relative w-full max-w-sm p-7 text-center"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
          >
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <Icon size={28} />
            </div>
            <h2 id="welcome-title" className="text-2xl font-extrabold text-ink">{title}</h2>
            <p className="mt-2 text-ink-muted">{message}</p>
            <button autoFocus onClick={onOk} className="btn-primary mt-6 w-full text-base">
              OK
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
