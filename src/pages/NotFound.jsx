import { Link } from 'react-router-dom'
import { Home, PackageX } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="bg-hero-grad">
      <div className="container-x flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-grad text-white shadow-glow">
          <PackageX size={36} />
        </div>
        <h1 className="mt-8 text-5xl font-extrabold text-ink">404</h1>
        <p className="mt-3 max-w-sm text-ink-muted">
          This parcel took a wrong turn. The page you’re looking for doesn’t exist.
        </p>
        <Link to="/" className="btn-primary mt-8">
          <Home size={18} /> Back home
        </Link>
      </div>
    </div>
  )
}
