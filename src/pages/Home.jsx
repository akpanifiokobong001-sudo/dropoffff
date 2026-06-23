import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Globe2, Zap, ShieldCheck, MapPin, PackageCheck, Headphones,
  Plane, ArrowRight, Star, Truck, Clock, Box,
} from 'lucide-react'
import Reveal from '../components/Reveal.jsx'
import SectionHeading from '../components/Section.jsx'
import FeatureCard from '../components/FeatureCard.jsx'
import { LogoMark } from '../components/Logo.jsx'

const stats = [
  { value: '220+', label: 'Countries & territories' },
  { value: '4.9★', label: 'Average customer rating' },
  { value: '2.1M', label: 'Parcels delivered' },
  { value: '48h', label: 'Avg. express delivery' },
]

const features = [
  { icon: Globe2, tint: 'brand', title: 'Truly worldwide', description: 'Ship to every country on the map — from Argentina to Zimbabwe — with door-to-door coverage.' },
  { icon: Zap, tint: 'teal', title: 'Lightning fast', description: 'Express and Priority options get your parcel across the globe in as little as 48 hours.' },
  { icon: ShieldCheck, tint: 'brand', title: 'Protected & insured', description: 'Every shipment is covered. Track it in real time and relax — we’ve got it from here.' },
  { icon: PackageCheck, tint: 'teal', title: 'Live tracking', description: 'Follow your parcel through every checkpoint with a clean, real-time timeline.' },
  { icon: Headphones, tint: 'brand', title: '24/7 human support', description: 'Real people, any time zone. Get help whenever and wherever you need it.' },
  { icon: MapPin, tint: 'teal', title: 'Easy drop-off & pickup', description: 'Schedule a doorstep pickup or drop at thousands of partner points worldwide.' },
]

const steps = [
  { icon: Box, title: 'Pack & quote', desc: 'Tell us where it’s going and what’s inside. Get an instant price in seconds.' },
  { icon: Truck, title: 'We collect it', desc: 'Book a pickup or drop at a nearby point. We handle customs paperwork for you.' },
  { icon: PackageCheck, title: 'Delivered & tracked', desc: 'Watch it move across the world and land safely at the recipient’s door.' },
]

const testimonials = [
  { name: 'Amara O.', role: 'Small business owner · Lagos', quote: 'DropOff made shipping to my customers in Europe effortless. The tracking is gorgeous and support actually answers.' },
  { name: 'Liam R.', role: 'Freelancer · Toronto', quote: 'Sent documents to Tokyo and they arrived in two days. The quote was exactly what I paid. No surprises.' },
  { name: 'Sofia M.', role: 'Online seller · Madrid', quote: 'I ship worldwide every week now. The instant pricing across 200+ countries is a game changer.' },
  { name: 'Jordan T.', role: 'Etsy shop owner · Austin, TX', quote: 'As a US seller shipping to customers overseas, DropOff is the first service that made international rates make sense. My buyers love the tracking.' },
  { name: 'Emily C.', role: 'Grad student · Boston, MA', quote: 'I send care packages to my family back in the Philippines all the time. DropOff is cheaper than the post office and twice as fast.' },
  { name: 'Marcus W.', role: 'eCommerce founder · Seattle, WA', quote: 'We scaled from shipping in 5 countries to 40 without changing a thing. The instant quotes plug right into how we work. Total lifesaver.' },
]

const faqs = [
  { q: 'Which countries can I ship to?', a: 'All of them — DropOff delivers to 220+ countries and territories worldwide, with door-to-door service in most.' },
  { q: 'How is the price calculated?', a: 'Price depends on the route distance, the parcel weight, and the service tier you choose. You’ll see a live estimate before you book.' },
  { q: 'Can I track my parcel?', a: 'Yes. Every shipment gets a tracking number and a real-time timeline from pickup to delivery.' },
  { q: 'What about customs?', a: 'We generate the customs paperwork for you and guide you through any restricted items for the destination country.' },
]

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* ===== HERO ===== */}
      <section className="relative bg-hero-grad">
        <div className="container-x grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-8">
          <div>
            <Reveal>
              <span className="chip mb-5 border border-brand-100 bg-white/70 text-brand-600">
                <Globe2 size={14} /> Delivering to 220+ countries
              </span>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="text-4xl font-extrabold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
                Send anything,
                <br />
                <span className="gradient-text">anywhere</span> in the world.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-soft">
                DropOff is the simplest way to ship parcels across borders. Instant quotes,
                fully-tracked delivery, and real human support — to every corner of the globe.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/send" className="btn-primary text-base">
                  Get an instant quote <ArrowRight size={18} />
                </Link>
                <Link to="/track" className="btn-secondary text-base">
                  Track a shipment
                </Link>
              </div>
            </Reveal>
            <Reveal delay={0.2}>
              <div className="mt-8 flex items-center gap-4 text-sm text-ink-muted">
                <div className="flex -space-x-2">
                  {['🇺🇸', '🇯🇵', '🇳🇬', '🇧🇷', '🇩🇪'].map((f) => (
                    <span
                      key={f}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white text-lg shadow-sm"
                    >
                      {f}
                    </span>
                  ))}
                </div>
                <span>
                  Loved by senders in <strong className="text-ink">190+ countries</strong>
                </span>
              </div>
            </Reveal>
          </div>

          {/* Hero visual */}
          <Reveal delay={0.15}>
            <HeroVisual />
          </Reveal>
        </div>
      </section>

      {/* ===== STATS BAND ===== */}
      <section className="container-x -mt-4 sm:-mt-8">
        <Reveal>
          <div className="card grid grid-cols-2 gap-6 p-7 sm:p-9 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-3xl font-extrabold text-ink sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-sm text-ink-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading
          eyebrow="How it works"
          title="From your door to theirs in three steps"
          subtitle="No logistics degree required. DropOff handles the hard parts so you don’t have to."
        />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.08}>
              <div className="card relative h-full p-7">
                <span className="absolute right-6 top-6 text-5xl font-extrabold text-ink/5">
                  0{i + 1}
                </span>
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-grad text-white shadow-glow">
                  <s.icon size={22} />
                </div>
                <h3 className="mt-5 text-xl font-bold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-x">
          <SectionHeading
            eyebrow="Why DropOff"
            title="Everything you need to ship globally"
            subtitle="Powerful where it counts, simple where it matters."
          />
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <FeatureCard {...f} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== COVERAGE CTA ===== */}
      <section className="container-x py-20 sm:py-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-ink px-8 py-14 text-white sm:px-14 sm:py-20">
            <div className="absolute inset-0 bg-hero-grad opacity-40" />
            <div className="relative grid items-center gap-10 lg:grid-cols-2">
              <div>
                <span className="chip mb-5 border border-white/15 bg-white/10 text-white">
                  <Plane size={14} /> Global coverage
                </span>
                <h2 className="text-3xl font-extrabold leading-tight sm:text-4xl">
                  One network. Every country on Earth.
                </h2>
                <p className="mt-4 max-w-md text-white/70">
                  Whether it’s next door or across an ocean, DropOff connects 220+ countries through
                  one beautifully simple platform.
                </p>
                <Link to="/send" className="btn-primary mt-7 text-base">
                  Start shipping <ArrowRight size={18} />
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                {['🌍 Africa', '🌎 Americas', '🌏 Asia', '🇪🇺 Europe', '🕌 Middle East', '🏝️ Oceania'].map(
                  (r) => (
                    <div
                      key={r}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-5 text-sm font-semibold backdrop-blur"
                    >
                      {r}
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <section className="bg-white py-20 sm:py-28">
        <div className="container-x">
          <SectionHeading
            eyebrow="Loved worldwide"
            title="Trusted by senders everywhere"
          />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08}>
                <div className="card h-full p-7">
                  <div className="flex gap-0.5 text-brand-500">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} size={16} fill="currentColor" />
                    ))}
                  </div>
                  <p className="mt-4 text-ink-soft">“{t.quote}”</p>
                  <div className="mt-6">
                    <div className="font-bold text-ink">{t.name}</div>
                    <div className="text-sm text-ink-muted">{t.role}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="container-x py-20 sm:py-28">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <div className="mx-auto mt-12 max-w-3xl space-y-4">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <details className="card group p-6">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-ink">
                  {f.q}
                  <span className="ml-4 text-brand-500 transition group-open:rotate-45">＋</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ===== FINAL CTA ===== */}
      <section className="container-x pb-24">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-brand-grad px-8 py-16 text-center text-white sm:py-20">
            <Clock className="absolute -left-6 -top-6 opacity-10" size={120} />
            <PackageCheck className="absolute -bottom-8 -right-6 opacity-10" size={140} />
            <h2 className="relative text-3xl font-extrabold sm:text-4xl">
              Ready to send something across the world?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-white/85">
              Get a free instant quote in under a minute. No account needed to start.
            </p>
            <Link
              to="/send"
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-bold text-brand-600 transition hover:-translate-y-0.5 hover:shadow-soft"
            >
              Get my quote <ArrowRight size={18} />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  )
}

// Animated hero artwork: a floating parcel + orbiting globe, all CSS/SVG.
function HeroVisual() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      <div className="absolute inset-0 rounded-[2.5rem] bg-brand-grad opacity-10 blur-2xl" />
      <div className="card relative flex h-full flex-col items-center justify-center gap-6 overflow-hidden p-8">
        {/* Orbit rings */}
        <div className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-ink/10" />
        <div className="pointer-events-none absolute inset-16 rounded-full border border-dashed border-ink/10" />

        <motion.div
          className="relative z-10 flex h-28 w-28 items-center justify-center rounded-3xl bg-brand-grad text-white shadow-glow"
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <LogoMark size={64} />
        </motion.div>

        {/* Orbiting badges */}
        <motion.div
          className="absolute left-6 top-10 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-ink shadow-card"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          ✈️ In transit
        </motion.div>
        <motion.div
          className="absolute bottom-12 right-5 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-teal-600 shadow-card"
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          ✅ Delivered
        </motion.div>
        <motion.div
          className="absolute bottom-6 left-10 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-brand-600 shadow-card"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
        >
          🌍 220+ countries
        </motion.div>

        <div className="relative z-10 text-center">
          <div className="text-sm font-semibold text-ink-muted">Estimated delivery</div>
          <div className="text-2xl font-extrabold text-ink">48 hours</div>
        </div>
      </div>
    </div>
  )
}
