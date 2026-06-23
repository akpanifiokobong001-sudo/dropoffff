import { useState, useRef, useEffect, useMemo } from 'react'
import { ChevronDown, Search, Check } from 'lucide-react'
import { countries, countryByCode } from '../data/countries.js'

// Searchable country dropdown. `value` is an ISO code; `onChange` gets the new code.
export default function CountrySelect({ id, label, value, onChange, placeholder = 'Select a country' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const inputRef = useRef(null)

  const selected = value ? countryByCode[value] : null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q,
    )
  }, [query])

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

  function pick(code) {
    onChange(code)
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
          {selected ? (
            <>
              <span className="text-xl leading-none">{selected.flag}</span>
              <span className="truncate font-medium text-ink">{selected.name}</span>
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
              placeholder="Search 196 countries…"
              className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-ink-muted"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto py-1" role="listbox">
            {filtered.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-ink-muted">No countries found</li>
            )}
            {filtered.map((c) => {
              const isSel = c.code === value
              return (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => pick(c.code)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                      isSel ? 'bg-brand-50 text-brand-700' : 'hover:bg-cloud'
                    }`}
                    role="option"
                    aria-selected={isSel}
                  >
                    <span className="text-xl leading-none">{c.flag}</span>
                    <span className="flex-1 truncate font-medium">{c.name}</span>
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
