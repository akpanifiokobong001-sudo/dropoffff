import { User, MapPin, Building2, Phone } from 'lucide-react'

// Sender / recipient contact fields (name, address, city, phone). `accent`
// tints the header so the two parties read as distinct. Shared by the Send flow
// and the Track page's inline edit form. `contact` is { name, address, city,
// phone }; `onField(key, value)` merges a single field.
export default function ContactFields({ title, accent, contact, onField }) {
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

// A single text input with a leading icon.
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
