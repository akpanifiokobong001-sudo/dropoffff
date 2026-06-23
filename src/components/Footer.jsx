import { Link } from 'react-router-dom'
import { Mail, MapPin, Twitter, Instagram, Linkedin } from 'lucide-react'
import Logo from './Logo.jsx'
import { WhatsAppIcon } from './WhatsAppButton.jsx'
import { buildWhatsAppLink, WHATSAPP_DISPLAY, CONTACT_EMAIL } from '../lib/contact.js'

const cols = [
  {
    title: 'Ship',
    links: [
      { to: '/send', label: 'Send a package' },
      { to: '/track', label: 'Track a shipment' },
      { to: '/pricing', label: 'Pricing & services' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About DropOff' },
      { to: '/about', label: 'Careers' },
      { to: '/about', label: 'Sustainability' },
    ],
  },
  {
    title: 'Support',
    links: [
      { to: '/about', label: 'Help center' },
      { to: '/about', label: 'Contact us' },
      { to: '/about', label: 'Prohibited items' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/5 bg-white">
      <div className="container-x grid grid-cols-2 gap-10 py-14 md:grid-cols-5">
        <div className="col-span-2">
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-muted">
            Send anything, anywhere in the world. Fast, reliable, fully-tracked international
            delivery to 220+ countries and territories.
          </p>
          <div className="mt-5 flex items-center gap-3">
            {[Twitter, Instagram, Linkedin].map((Icon, i) => (
              <a
                key={i}
                href="#"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-cloud text-ink-soft transition hover:bg-brand-50 hover:text-brand-600"
                aria-label="Social link"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {cols.map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-bold text-ink">{col.title}</h4>
            <ul className="mt-4 space-y-3">
              {col.links.map((l, i) => (
                <li key={i}>
                  <Link
                    to={l.to}
                    className="text-sm text-ink-muted transition hover:text-brand-600"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink/5">
        <div className="container-x flex flex-col items-start justify-between gap-4 py-6 text-sm text-ink-muted sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} DropOff. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex items-center gap-1.5 transition hover:text-brand-600"
            >
              <Mail size={14} /> {CONTACT_EMAIL}
            </a>
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 transition hover:text-[#25D366]"
            >
              <WhatsAppIcon size={14} /> {WHATSAPP_DISPLAY}
            </a>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} /> Global HQ · Remote-first
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
