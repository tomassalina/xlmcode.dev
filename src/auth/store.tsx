/* eslint-disable react-refresh/only-export-components --
   Context file: the provider and its hook are intentionally co-located. The
   rule is a dev-only fast-refresh hint and does not affect runtime. */
import { createContext, useContext, useState, type ReactNode } from 'react'

/**
 * Fake auth for the MVP. "Signing in" just sets a demo user (persisted in
 * localStorage so a refresh keeps you in). Real auth is post-MVP (Supabase).
 */
export interface User {
  name: string
  email: string
}

interface AuthValue {
  user: User | null
  login: () => void
  logout: () => void
}

const STORAGE_KEY = 'stellarable-user'
const DEMO_USER: User = { name: 'Tomás Salina', email: 'tomas@stellarable.dev' }

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as User) : null
    } catch {
      return null
    }
  })

  const login = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEMO_USER))
    setUser(DEMO_USER)
  }
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
