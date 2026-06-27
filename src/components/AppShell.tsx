import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../auth/store'

/** Authed app layout: collapsible sidebar + routed body (no top header). */
export function AppShell() {
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  // Fake guard: not "logged in" → back to the marketing landing.
  if (!user) return <Navigate to="/" replace />

  return (
    <div className="flex h-full select-none bg-black text-zinc-50">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  )
}
