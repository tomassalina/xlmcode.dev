/* eslint-disable react-refresh/only-export-components --
   Context file: the provider and its hook are intentionally co-located. The
   rule is a dev-only fast-refresh hint and does not affect runtime. */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import { api } from '../lib/backend'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

export interface User {
  id: string
  name: string
  email: string
  avatar_url?: string
}

interface AuthContextValue {
  user: User | null
  profile: unknown | null
  loading: boolean
  startOtp: (email: string) => Promise<void>
  verifyOtp: (email: string, token: string) => Promise<void>
  loginWithGoogle: () => void
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ user: User; profile: unknown }>('/auth/me')
      .then(({ user: u, profile: p }) => {
        setUser(u)
        setProfile(p)
      })
      .catch(() => {
        setUser(null)
        setProfile(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const startOtp = async (email: string) => {
    await api('/auth/otp/start', {
      method: 'POST',
      body: JSON.stringify({ email }),
    })
  }

  const verifyOtp = async (email: string, token: string) => {
    const { user: u } = await api<{ user: User }>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, token }),
    })
    setUser(u)
  }

  const loginWithGoogle = () => {
    window.location.href = `${API_BASE}/auth/google`
  }

  const logout = async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, startOtp, verifyOtp, loginWithGoogle, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
