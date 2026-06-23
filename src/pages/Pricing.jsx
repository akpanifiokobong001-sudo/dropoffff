import { Link } from 'react-router-dom'
import { Check, ArrowRight, Zap, Crown, Leaf } from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import SectionHeading from '../components/Section.jsx'

const tiers = [
  {
    key: 'economy',
    name: 'Economy',
    icon: Leaf,
    from: 14,
    tagline: 'Best value for non-urgent parcels',
    features: ['Door-to-door worldwide', 'Standard tracking', '5–14 day delivery', 'Up to 30 kg', 'Carbon-offset option'],
    highlight: false,
  },
  {
    key: 'express',
    name: 'Express',
    icon: Zap,
    from: 29,
    tagline: 'The everyday favorite',
    features: ['Everything in Economy', 'Priority handling', '2–8 day delivery', 'Live timeline tracking', 'Full insurance included', 'Customs paperwork done for you'],
    highlight: true,
  },
  {
    key: 'priority',
    name: 'Priority',
    icon: Crown,
    from: 49,
    tagline: 'Fastest, white-glove service',
    features: ['Everything in Express', 'Fastest 1–4 day delivery', 'Dedicated support line', 'Signature on delivery', 'Premium insurance'],
    highlight: false,
  },
]

const compare = [
  ['Worldwide coverage (220+ countries)', true, true, true],
  ['Real-time tracking', true, true, true],
  ['Insurance included', false, true, true],
  ['Customs handling', false, true, true],
  ['Doorstep pickup', false, true, true],
  ['Dedicated support', false, false, true],
  ['Signature on delivery', false, false, true],
]

export default function Pricing() {
  return (
    <div>
      <BackButton className="px-4 pt-4" />
      <section className="bg-hero-grad">
        <div className="container-x py-14 text-center sm:py-20">
          <Reveal>
            <span className="chip mb-4 border border-brand-100 bg-white/70 text-brand-600">
              Simple, transparent pricing
            </span>
            <h1 className="text-3xl font-extrabold text-ink sm:text-5xl">
              Pick the speed that suits you
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-ink-muted">
              No hidden fees. The price you’re quoted is the price you pay — anywhere in the world.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container-x -mt-6 sm:-mt-10">
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal key={t.key} delay={i * 0.08}>
              <div
                className={`relative flex h-full flex-col rounded-3xl p-7 sm:p-8 ${
                  t.highlight
                    ? 'bg-ink text-white shadow-soft ring-2 ring-brand-500'
                    : 'card'
                }`}
              >
                {t.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${
                    t.highlight ? 'bg-white/10 text-brand-300' : 'bg-brand-50 text-brand-600'
                  }`}
                >
                  <t.icon size={22} />
                </div>
                <h3 className={`mt-5 text-xl font-bold ${t.highlight ? 'text-white' : 'text-ink'}`}>
                  {t.name}
                </h3>
                <p className={`mt-1 text-sm ${t.highlight ? 'text-white/70' : 'text-ink-muted'}`}>
                  {t.tagline}
                </p>
                <div className="mt-5 flex items-baseline gap-1">
                  <span className={`text-sm ${t.highlight ? 'text-white/60' : 'text-ink-muted'}`}>from</span>
                  <span className="text-4xl font-extrabold">${t.from}</span>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {t.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check
                        size={18}
                        className={`mt-0.5 shrink-0 ${t.highlight ? 'text-brand-300' : 'text-teal-500'}`}
                      />
                      <span className={t.highlight ? 'text-white/90' : 'text-ink-soft'}>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  to="/send"
                  className={`mt-7 ${
                    t.highlight
                      ? 'btn w-full bg-brand-500 text-white hover:bg-brand-600'
                      : 'btn-secondary w-full'
                  }`}
                >
                  Choose {t.name} <ArrowRight size={16} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading eyebrow="Compare" title="What’s included" />
        <Reveal>
          <div className="mt-12 overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink/5 bg-cloud text-ink">
                  <th className="p-4 text-left font-bold">Feature</th>
                  <th className="p-4 text-center font-bold">Economy</th>
                  <th className="p-4 text-center font-bold text-brand-600">Express</th>
                  <th className="p-4 text-center font-bold">Priority</th>
                </tr>
              </thead>
              <tbody>
                {compare.map((row, i) => (
                  <tr key={i} className="border-b border-ink/5 last:border-0">
                    <td className="p-4 font-medium text-ink-soft">{row[0]}</td>
                    {row.slice(1).map((on, j) => (
                      <td key={j} className="p-4 text-center">
                        {on ? (
                          <Check size={18} className="mx-auto text-teal-500" />
                        ) : (
                          <span className="text-ink-muted/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
