import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, Package, User, LogOut, LayoutDashboard, ChevronDown, LogIn, ShieldCheck } from 'lucide-react'
import Logo from './Logo.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/send', label: 'Send a Package' },
  { to: '/track', label: 'Track' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, isAdmin, user, logout } = useAuth()
  const menuRef = useRef(null)

  // Close mobile menu on route change
  useEffect(() => setOpen(false), [location.pathname])

  // Close account dropdown on route change
  useEffect(() => setMenuOpen(false), [location.pathname])

  // Close account dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleLogout() {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  const displayName = (user?.name || '').trim() || user?.email?.split('@')[0] || 'Account'

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? 'border-b border-ink/5 bg-white/80 backdrop-blur-xl' : 'bg-transparent'
      }`}
    >
      <nav className="container-x flex h-16 items-center justify-between sm:h-20">
        <Link to="/" aria-label="DropOff home">
          <Logo />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 lg:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive ? 'text-brand-600' : 'text-ink-soft hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          {isAuthenticated ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full border border-ink/10 bg-white py-1.5 pl-1.5 pr-3 text-sm font-semibold text-ink transition hover:border-ink/20"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-white">
                  <User size={15} />
                </span>
                <span className="max-w-[10rem] truncate">{displayName}</span>
                <ChevronDown size={15} className={`text-ink-muted transition ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-ink/5 bg-white py-1.5 shadow-card"
                >
                  <div className="border-b border-ink/5 px-4 py-2.5">
                    <div className="text-sm font-bold text-ink">{displayName}</div>
                    {user?.email && <div className="truncate text-xs text-ink-muted">{user.email}</div>}
                  </div>
                  {isAdmin && (
                    <Link
                      to="/admin"
                      role="menuitem"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-brand-600 hover:bg-brand-50"
                    >
                      <ShieldCheck size={16} /> Admin panel
                    </Link>
                  )}
                  <Link
                    to="/dashboard"
                    role="menuitem"
                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-ink/5"
                  >
                    <LayoutDashboard size={16} /> Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    role="menuitem"
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-ghost text-sm">
              <LogIn size={16} /> Sign in
            </Link>
          )}
          <Link to="/send" className="btn-primary text-sm">
            <Package size={16} />
            Send now
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink hover:bg-ink/5 lg:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="lg:hidden">
          <div className="container-x flex flex-col gap-1 border-t border-ink/5 bg-white pb-6 pt-3">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-xl px-4 py-3 text-base font-semibold transition ${
                    isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-soft hover:bg-ink/5'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
            <Link to="/send" className="btn-primary mt-3 w-full">
              <Package size={18} />
              Send a package
            </Link>

            <div className="mt-3 border-t border-ink/5 pt-3">
              {isAuthenticated ? (
                <>
                  <div className="px-4 pb-1">
                    <div className="text-sm font-bold text-ink">{displayName}</div>
                    {user?.email && <div className="truncate text-xs text-ink-muted">{user.email}</div>}
                  </div>
                  {isAdmin && (
                    <NavLink
                      to="/admin"
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-xl px-4 py-3 text-base font-semibold transition ${
                          isActive ? 'bg-brand-50 text-brand-600' : 'text-brand-600 hover:bg-brand-50'
                        }`
                      }
                    >
                      <ShieldCheck size={18} /> Admin panel
                    </NavLink>
                  )}
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-4 py-3 text-base font-semibold transition ${
                        isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-soft hover:bg-ink/5'
                      }`
                    }
                  >
                    <LayoutDashboard size={18} /> Dashboard
                  </NavLink>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-left text-base font-semibold text-red-600 hover:bg-red-50"
                  >
                    <LogOut size={18} /> Log out
                  </button>
                </>
              ) : (
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-xl px-4 py-3 text-base font-semibold transition ${
                      isActive ? 'bg-brand-50 text-brand-600' : 'text-ink-soft hover:bg-ink/5'
                    }`
                  }
                >
                  <LogIn size={18} /> Sign in
                </NavLink>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
