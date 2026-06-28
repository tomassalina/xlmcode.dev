import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Copy, Loader2 } from 'lucide-react'
import { useAuth } from '../auth/store'
import { useProjects } from '../projects/store'
import { LoginModal } from '../auth/LoginModal'
import { WorkspacePanel } from '../components/WorkspacePanel'
import type { Version } from '../projects/store'
import { fetchShared } from '../lib/backend'
import { Logo, Wordmark } from '../marketing/shared'
import type { DeployedContract, FileTree } from '../../shared/types'

type Loaded = { name: string; files: FileTree; contracts: DeployedContract[]; versions: Version[] }

/** Public read-only view of a shared project at /p/:token. View code, contracts
 *  and preview; clone (login required) to get an editable copy. */
export function SharedProject() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { cloneSharedProject } = useProjects()
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [cloning, setCloning] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  // Which tree is shown + a remount key, so viewing a version works read-only.
  const [view, setView] = useState<FileTree | null>(null)
  const [gen, setGen] = useState(1)

  useEffect(() => {
    if (!token) return
    fetchShared(token)
      .then((d) => {
        const files = (d.project.current_files ?? d.versions.at(-1)?.files ?? {}) as FileTree
        const versions: Version[] = (d.versions ?? []).map((v) => ({
          id: v.id,
          label: v.label ?? 'Version',
          summary: v.summary ?? '',
          fileTree: v.files ?? {},
          createdAt: new Date(v.created_at).getTime(),
        }))
        setData({ name: d.project.name, files, contracts: (d.contracts ?? []) as DeployedContract[], versions })
        setView(files)
      })
      .catch(() => setError('This shared project could not be found.'))
  }, [token])

  const openVersion = (id: string) => {
    const v = data?.versions.find((x) => x.id === id)
    if (!v) return
    setView(v.fileTree)
    setGen((g) => g + 1)
  }

  const doClone = async () => {
    if (!token) return
    setCloning(true)
    try {
      navigate(`/projects/${await cloneSharedProject(token)}`)
    } catch {
      setCloning(false)
      setError('Could not clone this project.')
    }
  }

  const clone = () => {
    if (!user) {
      setShowLogin(true)
      return
    }
    void doClone()
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-black text-zinc-400">
        <p className="text-[14px]">{error}</p>
        <button onClick={() => navigate('/')} className="rounded-lg border border-zinc-800 px-4 py-2 text-[13px] text-zinc-200 hover:border-zinc-700">
          Go home
        </button>
      </div>
    )
  }

  if (!data) {
    return <div className="flex h-full items-center justify-center bg-black text-[13px] text-zinc-500">Loading shared project…</div>
  }

  return (
    <div className="flex h-full flex-col bg-black text-zinc-50">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <div onClick={() => navigate('/')} className="flex cursor-pointer items-center gap-2.5">
          <Logo size={20} />
          <Wordmark size={16} />
          <span className="ml-2 rounded-full border border-zinc-700 px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-zinc-400">
            Shared · read-only
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden truncate text-[13px] text-zinc-400 sm:block">{data.name}</span>
          <button
            onClick={clone}
            disabled={cloning}
            className="flex items-center gap-2 rounded-full bg-[#FDDA24] px-4 py-2 text-[13px] font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {cloning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            {cloning ? 'Cloning…' : user ? 'Clone to build' : 'Sign in to clone'}
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <WorkspacePanel
          fileTree={view ?? data.files}
          projectName={data.name}
          contracts={data.contracts}
          versions={data.versions}
          onOpenVersion={openVersion}
          readOnly
          generation={gen}
        />
      </div>
      {showLogin && (
        <LoginModal onClose={() => setShowLogin(false)} onAuthed={() => void doClone()} />
      )}
    </div>
  )
}
