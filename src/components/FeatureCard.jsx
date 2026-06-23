import { motion } from 'framer-motion'

// Icon + title + description card with a hover lift.
export default function FeatureCard({ icon: Icon, title, description, tint = 'brand' }) {
  const tints = {
    brand: 'bg-brand-50 text-brand-600',
    teal: 'bg-teal-50 text-teal-600',
    ink: 'bg-ink/5 text-ink',
  }
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="card h-full p-6 sm:p-7"
    >
      <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tints[tint]}`}>
        <Icon size={22} />
      </div>
      <h3 className="mt-5 text-lg font-bold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
    </motion.div>
  )
}
