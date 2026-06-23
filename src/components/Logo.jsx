// DropOff logo: a gradient location-pin holding a package, plus the wordmark.
// `showText` toggles the wordmark; `size` controls the mark height in px.

export function LogoMark({ size = 46, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="DropOff logo"
    >
      <defs>
        <linearGradient id="dropoffGrad" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF7A4D" />
          <stop offset="0.5" stopColor="#FF5630" />
          <stop offset="1" stopColor="#0EA5A4" />
        </linearGradient>
      </defs>
      <path
        d="M32 4C20.4 4 11 13.2 11 24.6c0 14.2 17.6 31.4 19.4 33.1a2.4 2.4 0 0 0 3.2 0C35.4 56 53 38.8 53 24.6 53 13.2 43.6 4 32 4Z"
        fill="url(#dropoffGrad)"
      />
      <g transform="translate(32 25)">
        <path d="M-10 -5 L0 -10 L10 -5 L10 7 L0 12 L-10 7 Z" fill="#ffffff" fillOpacity="0.96" />
        <path d="M-10 -5 L0 0 L10 -5" stroke="#FF5630" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
        <path d="M0 0 L0 12" stroke="#FF5630" strokeWidth="1.6" />
        <path d="M0 -10 L0 0" stroke="#0EA5A4" strokeWidth="1.6" />
      </g>
    </svg>
  )
}

export default function Logo({ showText = true, size = 36, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      {showText && (
        <span className="font-display text-xl font-extrabold tracking-tight text-ink">
          Drop<span className="text-brand-500">Off</span>
        </span>
      )}
    </span>
  )
}
