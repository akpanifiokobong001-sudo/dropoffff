import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import * as api from '../lib/api.js'

const AuthContext = createContext(null)

// Auto-logout after this much inactivity (no mouse/keyboard/touch).
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // `loading` is true only during the initial token bootstrap, so guards can wait
  // before deciding to redirect.
  const [loading, setLoading] = useState(true)
  // Set when an auto-logout happens (e.g. idle timeout) so the UI can explain why.
  const [logoutReason, setLogoutReason] = useState(null)
  const idleTimer = useRef(null)

  // On mount: if we have a stored token, validate it by fetching the current user.
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!api.getToken()) {
        setLoading(false)
        return
      }
      try {
        const me = await api.fetchMe()
        if (!cancelled) setUser(me)
      } catch {
        // Token invalid/expired — drop it.
        api.setToken(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => { cancelled = true }
  }, [])

  const login = useCallback(async (credentials) => {
    const { token, user: u } = await api.login(credentials)
    api.setToken(token)
    setUser(u)
    setLogoutReason(null)
    return u
  }, [])

  const register = useCallback(async (details) => {
    const { token, user: u } = await api.register(details)
    api.setToken(token)
    setUser(u)
    return u
  }, [])

  // Complete a password reset with { email, code, password }; the server logs
  // the user straight in, so we apply the returned session like login/register.
  const resetWithCode = useCallback(async (details) => {
    const { token, user: u } = await api.resetPassword(details)
    api.setToken(token)
    setUser(u)
    setLogoutReason(null)
    return u
  }, [])

  const logout = useCallback((reason = null) => {
    api.setToken(null)
    setUser(null)
    setLogoutReason(reason)
  }, [])

  // --- Idle auto-logout -----------------------------------------------------
  // While a user is logged in, reset a timer on any activity. If no activity
  // occurs for IDLE_TIMEOUT_MS, log them out automatically.
  useEffect(() => {
    if (!user) return

    const clear = () => { if (idleTimer.current) clearTimeout(idleTimer.current) }
    const reset = () => {
      clear()
      idleTimer.current = setTimeout(() => {
        logout('You were signed out after 5 minutes of inactivity.')
      }, IDLE_TIMEOUT_MS)
    }

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset() // start the countdown

    return () => {
      clear()
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [user, logout])

  const value = {
    user, loading, isAuthenticated: !!user, isAdmin: user?.role === 'admin',
    login, register, logout, resetWithCode,
    logoutReason, clearLogoutReason: () => setLogoutReason(null),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
