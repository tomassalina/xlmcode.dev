import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuth } from '../auth/store'
import { useFreighterBridge } from '../wallet/freighterBridge'

/** Authed app layout: collapsible sidebar + routed body (no top header). */
export function AppShell() {
  const { user, loading } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  // Answer Freighter requests forwarded from the preview iframe (top-level only).
  useFreighterBridge()

  if (loading) return null

  // Not authenticated → back to the marketing landing.
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
