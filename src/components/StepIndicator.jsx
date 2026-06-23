import { Check } from 'lucide-react'

// Horizontal step indicator for the multi-step Send flow.
export default function StepIndicator({ steps, current }) {
  return (
    <ol className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2.5">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${
                  done
                    ? 'bg-teal-500 text-white'
                    : active
                      ? 'bg-brand-500 text-white shadow-glow'
                      : 'bg-ink/5 text-ink-muted'
                }`}
              >
                {done ? <Check size={16} /> : i + 1}
              </span>
              <span
                className={`hidden text-sm font-semibold sm:block ${
                  active ? 'text-ink' : 'text-ink-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span
                className={`mx-3 h-0.5 flex-1 rounded ${done ? 'bg-teal-400' : 'bg-ink/10'}`}
              />
            )}
          </li>
        )
      })}
    </ol>
  )
}
