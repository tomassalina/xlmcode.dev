import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Plus,
  MessageSquare,
  Sparkles,
  User,
  LogOut,
  PanelLeft,
} from 'lucide-react'
import { useProjects } from '../projects/store'
import { useAuth } from '../auth/store'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * v0-style collapsible sidebar: brand → home, new project, project history, and
 * the user profile pinned bottom-left. Collapses to an icon rail.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { projects } = useProjects()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ${
        collapsed ? 'w-14' : 'w-64'
      }`}
    >
      {/* Brand → home, with the collapse toggle to its right */}
      <div className="flex h-14 items-center justify-between px-3">
        {!collapsed && (
          <Link
            to="/app"
            className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-zinc-900/50"
            title="xlmcode — home"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-violet-400" />
            <span className="text-[15px] font-medium tracking-tight">
              xlmcode
            </span>
          </Link>
        )}
        <button
          onClick={onToggle}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
          className={`rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-zinc-100 ${
            collapsed ? 'mx-auto' : ''
          }`}
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>

      {/* New project */}
      <div className="px-2 py-2">
        <Link
          to="/app"
          className={`flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-2 text-[13px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50 ${
            collapsed ? 'justify-center' : ''
          }`}
          title="New project"
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New project</span>}
        </Link>
      </div>

      {/* History */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">
        {!collapsed && (
          <p className="px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-600">
            Projects
          </p>
        )}
        <nav className="flex flex-col gap-0.5">
          {projects.map((p) => (
            <NavLink
              key={p.slug}
              to={`/projects/${p.slug}`}
              className={({ isActive }) =>
                `group relative flex items-center gap-2 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                  isActive
                    ? 'bg-zinc-900 text-zinc-50'
                    : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{p.name}</span>}
              {collapsed && (
                <span className="pointer-events-none absolute left-full z-50 ml-2 hidden max-w-[220px] truncate whitespace-nowrap rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[12.5px] text-zinc-100 shadow-xl group-hover:block">
                  {p.name}
                </span>
              )}
            </NavLink>
          ))}
          {!collapsed && projects.length === 0 && (
            <p className="px-2.5 py-2 text-[12.5px] text-zinc-600">
              No projects yet.
            </p>
          )}
        </nav>
      </div>

      {/* User profile (bottom-left) — opens a popover menu */}
      {user && (
        <div className="relative border-t border-zinc-800 p-2">
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute bottom-full left-2 z-20 mb-1 w-56 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
                <div className="border-b border-zinc-800 px-2.5 py-2">
                  <p className="truncate text-[13px] text-zinc-100">
                    {user.name}
                  </p>
                  <p className="truncate text-[11.5px] text-zinc-500">
                    {user.email}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/profile')
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-50"
                >
                  <User className="h-4 w-4" />
                  Profile
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    logout()
                    navigate('/')
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-red-400"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            title={user.name}
            className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-zinc-900/50 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-300">
              {initials(user.name)}
            </div>
            {!collapsed && (
              <div className="min-w-0 text-left">
                <p className="truncate text-[13px] text-zinc-200">{user.name}</p>
                <p className="truncate text-[11px] text-zinc-500">
                  {user.email}
                </p>
              </div>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
