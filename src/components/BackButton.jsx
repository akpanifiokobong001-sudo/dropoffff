import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Shared "go back" button used across pages. Navigates to the previous
// history entry. Pass `className` for per-page spacing/positioning.
export default function BackButton({ className = '', label = 'Back' }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(-1)}
      className={`flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium mb-4 transition ${className}`}
    >
      <ArrowLeft size={18} /> {label}
    </button>
  )
}
