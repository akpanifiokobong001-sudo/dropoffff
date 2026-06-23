import Reveal from './Reveal.jsx'

// Standard section header: eyebrow chip + title + optional subtitle, centered or left.
export default function SectionHeading({ eyebrow, title, subtitle, align = 'center' }) {
  const alignment = align === 'center' ? 'text-center mx-auto' : 'text-left'
  return (
    <Reveal>
      <div className={`max-w-2xl ${alignment}`}>
        {eyebrow && (
          <span className="chip mb-4 border border-brand-100 bg-brand-50/60 text-brand-600">
            {eyebrow}
          </span>
        )}
        <h2 className="text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{title}</h2>
        {subtitle && (
          <p className="mt-4 text-base leading-relaxed text-ink-muted sm:text-lg">{subtitle}</p>
        )}
      </div>
    </Reveal>
  )
}
