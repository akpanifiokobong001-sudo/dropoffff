import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, Package, ShieldAlert, PackageCheck, CheckCheck, Loader2 } from 'lucide-react'
import { fetchNotifications, markNotificationRead, markAllNotificationsRead } from '../lib/api.js'

const POLL_MS = 60 * 1000 // refresh the unread count every minute

// Pick an icon per notification type.
function iconFor(type) {
  if (type === 'security') return ShieldAlert
  if (type === 'shipment_status') return PackageCheck
  return Package // 'booking' and anything else
}

// "just now" / "5m ago" / "3h ago" / "2d ago" from an ISO timestamp.
function relativeTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (!Number.isFinite(diff)) return ''
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { notifications, unreadCount } = await fetchNotifications()
      setItems(notifications)
      setUnread(unreadCount)
    } catch {
      // Silent — a transient feed failure shouldn't disrupt the navbar.
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + polling. Cleared on unmount (which also covers logout, since
  // the bell is only rendered while authenticated).
  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  // Refetch whenever the dropdown is opened so it's always current.
  useEffect(() => {
    if (open) load()
  }, [open, load])

  // Close on route change.
  useEffect(() => setOpen(false), [location.pathname])

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function onItemClick(n) {
    // Optimistically mark read, then sync the server.
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
      markNotificationRead(n.id).catch(() => {})
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  async function onMarkAll() {
    setItems((list) => list.map((x) => ({ ...x, read: true })))
    setUnread(0)
    try { await markAllNotificationsRead() } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-white text-ink-soft transition hover:border-ink/20 hover:text-ink"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-card"
        >
          <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
            <div className="text-sm font-bold text-ink">Notifications</div>
            {unread > 0 && (
              <button
                onClick={onMarkAll}
                className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={20} className="animate-spin text-brand-500" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                  <Bell size={20} />
                </span>
                <p className="text-sm text-ink-muted">You’re all caught up.</p>
              </div>
            ) : (
              <ul className="divide-y divide-ink/5">
                {items.map((n) => {
                  const Icon = iconFor(n.type)
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => onItemClick(n)}
                        className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink/[0.03] ${
                          n.read ? '' : 'bg-brand-50/40'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                            n.type === 'security' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-600'
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-ink">{n.title}</span>
                            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                          </span>
                          {n.body && <span className="mt-0.5 block text-xs text-ink-muted">{n.body}</span>}
                          <span className="mt-1 block text-[11px] font-medium text-ink-muted">
                            {relativeTime(n.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
