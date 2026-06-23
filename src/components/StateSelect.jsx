import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Check, MapPin } from 'lucide-react'
import { statesOf } from '../data/states.js'

// Searchable state/province dropdown for a given country code. `value` is the
// chosen subdivision name; `onChange` gets the new name. Mirrors CountrySelect's
// UX so the Route step feels consistent. Renders nothing useful until a country
// is chosen — the parent decides whether to show it.
export default function StateSelect({ id, label, countryCode, value, onChange, placeholder = 'Select a state' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const options = useMemo(() => statesOf(countryCode), [countryCode])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((s) => s.toLowerCase().includes(q))
  }, [query, options])

  // Close on outside click
  useEffect(() => {
    function onDoc(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  // Focus search field when opening
  useEffect(() => {
    if (open) {
      setQuery('')
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
  }, [open])

  function pick(name) {
    onChange(name)
    setOpen(false)
  }

  return (
    <div className="relative" ref={rootRef}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input flex items-center justify-between text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5 truncate">
          {value ? (
            <>
              <MapPin size={16} className="shrink-0 text-brand-500" />
              <span className="truncate font-medium text-ink">{value}</span>
            </>
          ) : (
            <span className="text-ink-muted">{placeholder}</span>
          )}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-ink-muted transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-soft">
          <div className="flex items-center gap-2 border-b border-ink/5 px-3">
            <Search size={16} className="text-ink-muted" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${options.length} states…`}
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-muted"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">No states found</li>
            )}
            {filtered.map((s) => {
              const isSel = s === value
              return (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => pick(s)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      isSel ? 'bg-brand-50 text-brand-700' : 'hover:bg-cloud'
                    }`}
                    role="option"
                    aria-selected={isSel}
                  >
                    <MapPin size={15} className={isSel ? 'text-brand-500' : 'text-ink-muted'} />
                    <span className="flex-1 truncate font-medium">{s}</span>
                    {isSel && <Check size={16} className="text-brand-500" />}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
