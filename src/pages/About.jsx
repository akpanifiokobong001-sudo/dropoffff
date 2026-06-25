import { useState } from 'react'
import { Globe2, Heart, Leaf, Users, Send, CheckCircle2, Mail } from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import BackButton from '../components/BackButton.jsx'
import SectionHeading from '../components/Section.jsx'
import { CONTACT_EMAIL } from '../lib/contact.js'

const values = [
  { icon: Globe2, title: 'Borderless by design', desc: 'We believe distance shouldn’t decide what’s possible. Anyone, anywhere, can send to anyone.' },
  { icon: Heart, title: 'People first', desc: 'Real human support, honest pricing, and a product that respects your time.' },
  { icon: Leaf, title: 'Lighter footprint', desc: 'Carbon-offset shipping options and optimized routing on every parcel we move.' },
  { icon: Users, title: 'Built for everyone', desc: 'From a student mailing documents to a business shipping in bulk — DropOff scales with you.' },
]

const milestones = [
  { year: '2023', text: 'DropOff founded with one goal: make global shipping feel local.' },
  { year: '2024', text: 'Expanded coverage to 220+ countries and territories.' },
  { year: '2025', text: 'Crossed 2 million parcels delivered worldwide.' },
  { year: '2026', text: 'Launched instant cross-border quoting — the tool you’re using now.' },
]

export default function About() {
  const [sent, setSent] = useState(false)

  return (
    <div>
      <BackButton className="px-4 pt-4" />
      {/* Hero */}
      <section className="bg-hero-grad">
        <div className="container-x py-16 text-center sm:py-24">
          <Reveal>
            <span className="chip mb-4 border border-teal-100 bg-white/70 text-teal-600">
              Our story
            </span>
            <h1 className="mx-auto max-w-3xl text-3xl font-extrabold leading-tight text-ink sm:text-5xl">
              We’re on a mission to make the world feel{' '}
              <span className="gradient-text">a little smaller</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-soft">
              DropOff started with a simple frustration: sending a parcel abroad was slow, confusing,
              and full of surprises. So we rebuilt international shipping from the ground up — fast,
              transparent, and genuinely delightful to use.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Values */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading eyebrow="What we value" title="The principles behind DropOff" />
        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {values.map((v, i) => (
            <Reveal key={v.title} delay={(i % 2) * 0.08}>
              <div className="card flex h-full gap-4 p-7">
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <v.icon size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ink">{v.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{v.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Timeline */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-x">
          <SectionHeading eyebrow="Milestones" title="How far we’ve come" />
          <div className="mx-auto mt-14 max-w-2xl">
            {milestones.map((m, i) => (
              <Reveal key={m.year} delay={i * 0.06}>
                <div className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-grad text-sm font-bold text-white shadow-glow">
                      {m.year}
                    </span>
                    {i < milestones.length - 1 && <span className="my-1 w-0.5 flex-1 bg-ink/10" style={{ minHeight: 36 }} />}
                  </div>
                  <p className="pb-8 pt-3 text-ink-soft">{m.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="container-x py-20 sm:py-28">
        <div className="mx-auto max-w-2xl">
          <SectionHeading eyebrow="Get in touch" title="Say hello" subtitle="Questions, partnerships, or feedback — we’d love to hear from you." />
          <Reveal>
            <div className="-mt-4 mb-2 flex flex-col items-center gap-2 text-center text-sm text-ink-muted sm:flex-row sm:justify-center sm:gap-5">
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline"
              >
                <Mail size={14} /> {CONTACT_EMAIL}
              </a>
            </div>
          </Reveal>
          <Reveal>
            <form
              onSubmit={(e) => { e.preventDefault(); setSent(true) }}
              className="card mt-10 grid gap-4 p-6 sm:p-8"
            >
              {sent ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <CheckCircle2 size={40} className="text-teal-500" />
                  <h3 className="text-xl font-bold text-ink">Message sent!</h3>
                  <p className="text-ink-muted">Thanks for reaching out — we’ll get back to you shortly. (Demo only.)</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="name">Name</label>
                      <input id="name" required className="input" placeholder="Your name" />
                    </div>
                    <div>
                      <label className="label" htmlFor="email">Email</label>
                      <input id="email" type="email" required className="input" placeholder="you@example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="msg">Message</label>
                    <textarea id="msg" required rows={4} className="input resize-none" placeholder="How can we help?" />
                  </div>
                  <button type="submit" className="btn-primary justify-center">
                    <Send size={16} /> Send message
                  </button>
                </>
              )}
            </form>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
