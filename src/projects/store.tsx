/* eslint-disable react-refresh/only-export-components --
   Context file: the provider and its hook are intentionally co-located. The
   rule is a dev-only fast-refresh hint and does not affect runtime. */
import {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  type ReactNode,
} from 'react'
import type { ChatMessage, FileTree, DeployedContract } from '../../shared/types'
import type { Activity } from '../lib/api'
import { parseActivity, parseStreamingMessage } from '../lib/api'
import { applyFileOps, initialFileTree, injectDappPlumbing } from '../lib/project'
import { buildContractsFile, CONTRACTS_FILE } from '../lib/contracts'
import { api, streamChat, RateLimitError } from '../lib/backend'
import type { AgentAction } from '../../shared/types'

/**
 * In-memory project store with optional backend persistence.
 * Backend calls are best-effort: failures are logged but never crash the UI.
 */
export interface Version {
  id: string
  /** Short LLM-given name for this version. */
  label: string
  /** Concise summary of the change (the assistant message). */
  summary: string
  fileTree: FileTree
  createdAt: number
}

export interface ProjectState {
  /** Backend-assigned UUID (available after backend confirms creation). */
  id?: string
  slug: string
  name: string
  messages: ChatMessage[]
  fileTree: FileTree
  busy: boolean
  error: string | null
  /** Live activity during streaming (cosmetic): files being created/edited. */
  activity: Activity[]
  /** Partial assistant message while streaming. */
  streamingMessage: string
  /** Local checkpoint history (newest last). */
  versions: Version[]
  /**
   * Bumped only on canonical changes (LLM apply, restore, discard) — it is the
   * Sandpack remount key. User edits sync into fileTree WITHOUT bumping it, so
   * the editor doesn't reset mid-typing.
   */
  generation: number
  /** The last canonical file tree (to revert manual edits to). */
  savedFileTree: FileTree
  /** True when the user has manual, unsaved edits in the editor. */
  dirty: boolean
  /** Contracts deployed (or connected) for this project. */
  contracts: DeployedContract[]
  /** True once full project data has been loaded from the backend. */
  loaded?: boolean
  /** Read-only: a template or a shared project. Chat/editor/deploy disabled
   *  until the user clones it into their own account. */
  readOnly?: boolean
  /** Backend id of the source this read-only view was opened from (template or
   *  shared project) — used by the "Clone to build" action. */
  cloneSourceId?: string
}

interface ProjectsContextValue {
  /** All projects, newest first — for the sidebar history. */
  projects: ProjectState[]
  /** False until the initial project list has loaded from the backend. Used to
   *  avoid redirecting away from a valid project URL before we know it exists. */
  ready: boolean
  getProject: (slug: string) => ProjectState | undefined
  createProject: (prompt: string) => string
  /** Open a system template (read-only) into the store. Returns its slug. */
  openTemplate: (id: string) => Promise<string>
  /** Delete a project (and its versions/messages/contracts). */
  deleteProject: (slug: string) => Promise<void>
  send: (slug: string, text: string, opts?: { kind?: 'system' }) => void
  /** Load a checkpoint's files non-destructively (keeps all versions). */
  openVersion: (slug: string, versionId: string) => void
  /** Restore to a checkpoint AND discard everything after it (destructive). */
  restoreVersion: (slug: string, versionId: string) => void
  /** Rename a project (display name; reflected in the sidebar). */
  renameProject: (slug: string, name: string) => void
  /** Sync user edits from the editor into the file tree (no remount). */
  syncFiles: (slug: string, files: FileTree) => void
  /** Revert manual edits back to the last canonical file tree. */
  discardEdits: (slug: string) => void
  /** Accept the current edits as the saved baseline (clears the dirty toast). */
  markSaved: (slug: string) => void
  /** Create a file (or folder via a placeholder) at an absolute path. */
  createEntry: (slug: string, path: string, content?: string) => void
  /** Delete a file or a whole folder subtree at an absolute path. */
  deleteEntry: (slug: string, path: string) => void
  /** Record a deployed/connected contract and inject src/contracts.ts. */
  addDeployedContract: (slug: string, contract: DeployedContract) => void
  /** Mark the actions on a message as resolved (hides the action cards). */
  resolveMessageActions: (slug: string, messageIndex: number) => void
  /** Generate a share link for a project. Returns the share URL. */
  shareProject: (id: string) => Promise<string>
  /** Clone a project/template into the caller's account. Returns the new slug. */
  cloneProject: (id: string) => Promise<string>
  /** Clone a shared project (by token) into the caller's account. Returns slug. */
  cloneSharedProject: (token: string) => Promise<string>
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null)

function kebab(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function deriveName(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ')
  return words.length > 48 ? words.slice(0, 48) : words
}

// Clock/id behind module-scope helpers: keeps render bodies pure (no Date.now /
// crypto.* during render) and makes time/ids trivially mockable in tests.
const now = () => Date.now()
const uid = () => crypto.randomUUID()

const newVersion = (
  label: string,
  summary: string,
  fileTree: FileTree,
): Version => ({
  id: uid().slice(0, 8),
  label,
  summary,
  fileTree,
  createdAt: now(),
})

/** Extract the first complete JSON object from a (possibly partial) string. */
function parseFirstJsonObject(text: string): unknown {
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(text.slice(start, i + 1)) } catch { return null }
    }
  }
  try { return JSON.parse(text.slice(start)) } catch { return null }
}

type AgentRes = {
  message: string
  versionName?: string
  files: { op: 'create' | 'edit' | 'delete'; path: string; content: string }[]
  actions?: AgentAction[]
}

type BackendProject = {
  id: string
  slug: string
  name: string
  created_at: string
  updated_at: string
  /** Authoritative current file tree (server keeps this in sync on every edit). */
  current_files?: FileTree
}

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const ref = useRef<Record<string, ProjectState>>({})
  // `ref` holds the latest map for synchronous async reads; `snapshot` mirrors
  // it for rendering so we never read a ref during render.
  const [snapshot, setSnapshot] = useState<Record<string, ProjectState>>({})
  // False until the first GET /api/projects resolves — gates existence checks.
  const [ready, setReady] = useState(false)

  const commit = (next: Record<string, ProjectState>) => {
    ref.current = next
    setSnapshot(next)
  }

  const patch = (slug: string, partial: Partial<ProjectState>) => {
    const current = ref.current[slug]
    if (!current) return
    commit({ ...ref.current, [slug]: { ...current, ...partial } })
  }

  // On mount: load projects list from backend.
  useEffect(() => {
    api<BackendProject[]>('/api/projects')
      .then((list) => {
        const current = ref.current
        const next = { ...current }
        for (const p of list) {
          if (!next[p.slug]) {
            // Add as a stub; full data loads on demand.
            next[p.slug] = {
              id: p.id,
              slug: p.slug,
              name: p.name,
              messages: [],
              fileTree: {},
              busy: false,
              error: null,
              activity: [],
              streamingMessage: '',
              versions: [],
              generation: 1,
              savedFileTree: {},
              dirty: false,
              contracts: [],
              loaded: false,
            }
          } else if (!next[p.slug].id) {
            // Hydrate id on existing in-memory project
            next[p.slug] = { ...next[p.slug], id: p.id }
          }
        }
        commit(next)
      })
      .catch((err) => console.warn('[projects] failed to load list from backend:', err))
      .finally(() => setReady(true))
  }, [])

  const loadProject = async (slugOrId: string): Promise<void> => {
    // Find the slug from the map if an id was passed
    const slug =
      Object.keys(ref.current).find(
        (k) => k === slugOrId || ref.current[k].id === slugOrId,
      ) ?? slugOrId

    const p = ref.current[slug]
    if (!p?.id) return

    try {
      const data = await api<{
        project: BackendProject
        versions: { id: string; label: string; summary: string; files: FileTree; created_at: string }[]
        messages: { role: string; content: string; created_at: string }[]
        contracts: DeployedContract[]
      }>(`/api/projects/${p.id}`)

      const versions: Version[] = data.versions.map((v) => ({
        id: v.id,
        label: v.label ?? 'Version',
        summary: v.summary ?? '',
        fileTree: v.files ?? {},
        createdAt: new Date(v.created_at).getTime(),
      }))

      const messages: ChatMessage[] = data.messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        createdAt: new Date(m.created_at).getTime(),
      }))

      // current_files is the server's authoritative working tree (updated on
      // every edit/restore). Fall back to the latest version, then empty.
      const tree =
        data.project.current_files ?? versions.at(-1)?.fileTree ?? {}

      patch(slug, {
        versions,
        messages,
        contracts: data.contracts ?? [],
        fileTree: tree,
        savedFileTree: tree,
        loaded: true,
        // Bump generation so Sandpack remounts with the freshly loaded files —
        // the stub mounted with an empty tree (default "Hello world" preview).
        generation: (ref.current[slug]?.generation ?? 0) + 1,
      })
    } catch (err) {
      console.warn('[projects] failed to load project:', err)
    }
  }

  const send = async (slug: string, text: string, opts?: { kind?: 'system' }) => {
    const p = ref.current[slug]
    if (!p || p.busy || p.readOnly) return
    const history = p.messages
    const startedAt = now()
    const userMsg: ChatMessage = { role: 'user', content: text, createdAt: startedAt }
    if (opts?.kind) userMsg.kind = opts.kind
    patch(slug, {
      messages: [...history, userMsg],
      busy: true,
      error: null,
      activity: [],
      streamingMessage: '',
    })
    try {
      let accumulated = ''

      if (p.id) {
        // Backend streaming path
        await streamChat(
          p.id,
          { userMessage: text, history, fileTree: p.fileTree },
          (chunk) => {
            accumulated += chunk
            patch(slug, {
              activity: parseActivity(accumulated),
              streamingMessage: parseStreamingMessage(accumulated),
            })
          },
        )

        const res = parseFirstJsonObject(accumulated) as AgentRes | null
        if (!res) {
          patch(slug, { busy: false, activity: [], streamingMessage: '' })
          return
        }

        const latest = ref.current[slug]
        const nextTree = applyFileOps(latest.fileTree, res.files)
        const ops = res.files.map((f) => ({ op: f.op, path: f.path }))
        const name = res.versionName?.trim() || 'Update'
        let added = 0
        let removed = 0
        for (const f of res.files) {
          if (f.op === 'delete') {
            removed += (latest.fileTree[f.path]?.split('\n').length ?? 0)
            continue
          }
          const oldLines = new Set((latest.fileTree[f.path] ?? '').split('\n'))
          const newLines = new Set(f.content.split('\n'))
          for (const l of f.content.split('\n')) if (!oldLines.has(l)) added++
          for (const l of (latest.fileTree[f.path] ?? '').split('\n'))
            if (!newLines.has(l)) removed++
        }
        const changedFiles = res.files.length > 0
        const assistantMsg: ChatMessage = {
          role: 'assistant',
          content: res.message,
          files: ops,
          versionName: changedFiles ? name : undefined,
          createdAt: now(),
          stats: {
            durationMs: now() - startedAt,
            filesModified: res.files.length,
            added,
            removed,
          },
          ...(res.actions?.length ? { actions: res.actions } : {}),
        }
        patch(slug, {
          busy: false,
          activity: [],
          streamingMessage: '',
          messages: [...latest.messages, assistantMsg],
          ...(changedFiles
            ? {
                fileTree: nextTree,
                savedFileTree: nextTree,
                dirty: false,
                generation: latest.generation + 1,
                versions: [
                  ...latest.versions,
                  newVersion(name, res.message, nextTree),
                ],
              }
            : {}),
        })
      } else {
        // No backend id yet — nothing to stream; surface a clear error.
        patch(slug, {
          busy: false,
          activity: [],
          streamingMessage: '',
          error: 'Project is not yet saved to the backend. Please wait a moment and try again.',
        })
      }
    } catch (err) {
      const isRateLimit = err instanceof RateLimitError
      const errorMsg = isRateLimit
        ? 'Daily limit reached. Try again tomorrow.'
        : err instanceof Error
          ? err.message
          : 'Something went wrong'
      const latest = ref.current[slug]
      const errorAssistantMsg: ChatMessage = {
        role: 'assistant',
        content: errorMsg,
        createdAt: now(),
      }
      patch(slug, {
        busy: false,
        activity: [],
        streamingMessage: '',
        error: isRateLimit ? null : errorMsg,
        messages: isRateLimit
          ? [...latest.messages, errorAssistantMsg]
          : latest.messages,
      })
    }
  }

  const resolveMessageActions = (slug: string, messageIndex: number) => {
    const p = ref.current[slug]
    if (!p) return
    const messages = p.messages.map((m, i) =>
      i === messageIndex ? { ...m, actionsDone: true } : m,
    )
    patch(slug, { messages })
  }

  const make = (
    slug: string,
    name: string,
    fileTree: FileTree,
    messages: ChatMessage[],
    versions: Version[],
    contracts: DeployedContract[] = [],
  ) => {
    commit({
      ...ref.current,
      [slug]: {
        slug,
        name,
        messages,
        fileTree,
        busy: false,
        error: null,
        activity: [],
        streamingMessage: '',
        versions,
        generation: 1,
        savedFileTree: fileTree,
        dirty: false,
        contracts,
        loaded: true,
      },
    })
  }

  const createProject = (prompt: string): string => {
    const slug = `${kebab(deriveName(prompt)) || 'project'}-${uid().slice(0, 6)}`
    const tree = initialFileTree()
    make(slug, deriveName(prompt), tree, [], [])
    patch(slug, { busy: true })
    // Create server-side FIRST (persisting the scaffold), THEN send the prompt —
    // so the chat stream always has a project id (no "not yet saved" race).
    api<{ id: string; name: string }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name: deriveName(prompt), slug, current_files: tree }),
    })
      .then(({ id, name }) => {
        patch(slug, { id, name })
        void send(slug, prompt)
      })
      .catch((err) => {
        console.warn('[projects] failed to create project in backend:', err)
        patch(slug, {
          busy: false,
          error: 'Could not start the project. Please try again.',
        })
      })
    return slug
  }

  /** Load a system template into the store as a READ-ONLY project (chat/editor
   *  disabled). The "Clone to build" action turns it into the user's own copy. */
  const openTemplate = async (id: string): Promise<string> => {
    const data = await api<{
      project: BackendProject
      versions: { id: string; label: string; summary: string; files: FileTree; created_at: string }[]
      messages: { role: string; content: string; created_at: string }[]
      contracts: DeployedContract[]
    }>(`/api/projects/${id}`)

    const slug = data.project.slug
    const versions: Version[] = data.versions.map((v) => ({
      id: v.id,
      label: v.label ?? 'Version',
      summary: v.summary ?? '',
      fileTree: v.files ?? {},
      createdAt: new Date(v.created_at).getTime(),
    }))
    const messages: ChatMessage[] = data.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: new Date(m.created_at).getTime(),
    }))
    const tree = data.project.current_files ?? versions.at(-1)?.fileTree ?? {}

    commit({
      ...ref.current,
      [slug]: {
        id: data.project.id,
        slug,
        name: data.project.name,
        messages,
        fileTree: tree,
        busy: false,
        error: null,
        activity: [],
        streamingMessage: '',
        versions,
        generation: 1,
        savedFileTree: tree,
        dirty: false,
        contracts: data.contracts ?? [],
        loaded: true,
        readOnly: true,
        cloneSourceId: data.project.id,
      },
    })
    return slug
  }

  /** Delete a project and remove it from the store. */
  const deleteProject = async (slug: string): Promise<void> => {
    const p = ref.current[slug]
    if (p?.id) {
      await api(`/api/projects/${p.id}`, { method: 'DELETE' })
    }
    const next = { ...ref.current }
    delete next[slug]
    commit(next)
  }

  /** Non-destructive: load a checkpoint's files but keep every version. */
  const openVersion = (slug: string, versionId: string) => {
    const p = ref.current[slug]
    if (!p) return
    const v = p.versions.find((x) => x.id === versionId)
    if (!v) return
    patch(slug, {
      fileTree: v.fileTree,
      savedFileTree: v.fileTree,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  const restoreVersion = (slug: string, versionId: string) => {
    const p = ref.current[slug]
    if (!p) return
    const idx = p.versions.findIndex((x) => x.id === versionId)
    if (idx === -1) return
    const v = p.versions[idx]
    patch(slug, {
      fileTree: v.fileTree,
      savedFileTree: v.fileTree,
      dirty: false,
      // Destructive: drop every version after this one.
      versions: p.versions.slice(0, idx + 1),
      generation: p.generation + 1,
      messages: [
        ...p.messages,
        { role: 'assistant', content: `Restored "${v.label}".` },
      ],
    })
    // Persist best-effort
    if (p.id) {
      api(`/api/projects/${p.id}/versions/${versionId}/restore`, { method: 'POST' })
        .catch((err) => console.warn('[projects] failed to restore version:', err))
    }
  }

  /** User edited files in the editor — update the tree without remounting. */
  const syncFiles = (slug: string, files: FileTree) => {
    const p = ref.current[slug]
    if (!p) return
    const dirty =
      JSON.stringify(files) !== JSON.stringify(p.savedFileTree)
    patch(slug, { fileTree: files, dirty })
    // Persist best-effort
    if (p.id) {
      api(`/api/projects/${p.id}/files`, {
        method: 'PATCH',
        body: JSON.stringify({ files }),
      }).catch((err) => console.warn('[projects] failed to sync files:', err))
    }
  }

  /** Revert manual edits to the last canonical tree (remounts Sandpack). */
  const discardEdits = (slug: string) => {
    const p = ref.current[slug]
    if (!p) return
    patch(slug, {
      fileTree: p.savedFileTree,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Accept current edits as the new saved baseline (no remount, clears dirty). */
  const markSaved = (slug: string) => {
    const p = ref.current[slug]
    if (!p) return
    patch(slug, { savedFileTree: p.fileTree, dirty: false })
    // Persist best-effort
    if (p.id) {
      api(`/api/projects/${p.id}/files`, {
        method: 'PATCH',
        body: JSON.stringify({ files: p.fileTree }),
      }).catch((err) => console.warn('[projects] failed to mark saved:', err))
    }
  }

  /** Create a file/folder; structural change → bump generation (remount). */
  const createEntry = (slug: string, path: string, content = '') => {
    const p = ref.current[slug]
    if (!p || p.fileTree[path] !== undefined) return
    const next = { ...p.fileTree, [path]: content }
    patch(slug, {
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Delete a file or an entire folder subtree. */
  const deleteEntry = (slug: string, path: string) => {
    const p = ref.current[slug]
    if (!p) return
    const prefix = `${path}/`
    const next: FileTree = {}
    for (const [k, v] of Object.entries(p.fileTree)) {
      if (k === path || k.startsWith(prefix)) continue
      next[k] = v
    }
    patch(slug, {
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
  }

  /** Record a deployed contract and (re)generate src/contracts.ts in the app. */
  const addDeployedContract = (slug: string, contract: DeployedContract) => {
    const p = ref.current[slug]
    if (!p) return
    const contracts = [...p.contracts, contract]
    const next = {
      ...injectDappPlumbing(p.fileTree),
      [CONTRACTS_FILE]: buildContractsFile(contracts),
    }
    patch(slug, {
      contracts,
      fileTree: next,
      savedFileTree: next,
      dirty: false,
      generation: p.generation + 1,
    })
    // Persist best-effort
    if (p.id) {
      api(`/api/projects/${p.id}/contracts`, {
        method: 'POST',
        body: JSON.stringify(contract),
      }).catch((err) => console.warn('[projects] failed to save contract:', err))
    }
  }

  const renameProject = (slug: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const p = ref.current[slug]
    if (!p) return
    patch(slug, { name: trimmed })
    // Persist best-effort
    if (p.id) {
      api(`/api/projects/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: trimmed }),
      }).catch((err) => console.warn('[projects] failed to rename project:', err))
    }
  }

  const shareProject = async (id: string): Promise<string> => {
    const { url } = await api<{ token: string; url: string }>(
      `/api/projects/${id}/share`,
      { method: 'POST' },
    )
    return url
  }

  const cloneProject = async (id: string): Promise<string> => {
    const proj = await api<{ id: string; slug: string; name: string }>(
      `/api/projects/${id}/clone`,
      { method: 'POST' },
    )
    addClonedStub(proj)
    return proj.slug
  }

  const cloneSharedProject = async (token: string): Promise<string> => {
    const proj = await api<{ id: string; slug: string; name: string }>(
      `/api/shared/${token}/clone`,
      { method: 'POST' },
    )
    addClonedStub(proj)
    return proj.slug
  }

  /** Add a not-yet-hydrated project to the store so navigation works; full data
   *  loads on open (loaded:false → getProject triggers loadProject). */
  const addClonedStub = (proj: { id: string; slug: string; name: string }) => {
    commit({
      ...ref.current,
      [proj.slug]: {
        id: proj.id,
        slug: proj.slug,
        name: proj.name,
        messages: [],
        fileTree: {},
        busy: false,
        error: null,
        activity: [],
        streamingMessage: '',
        versions: [],
        generation: 1,
        savedFileTree: {},
        dirty: false,
        contracts: [],
        loaded: false,
      },
    })
  }

  const getProject = (slug: string): ProjectState | undefined => {
    const p = ref.current[slug]
    if (p && p.loaded === false) {
      // Trigger background load; UI will re-render when state updates
      void loadProject(slug)
    }
    return p
  }

  const value: ProjectsContextValue = {
    // Sidebar history = the user's OWN projects only. Read-only views (templates
    // / shared projects) live in the store so the editor can render them, but
    // they must never show up as if they were the user's projects.
    projects: Object.values(snapshot)
      .filter((p) => !p.readOnly)
      .reverse(),
    ready,
    getProject,
    createProject,
    openTemplate,
    deleteProject,
    send: (slug, text, opts) => void send(slug, text, opts),
    openVersion,
    restoreVersion,
    renameProject,
    syncFiles,
    discardEdits,
    markSaved,
    createEntry,
    deleteEntry,
    addDeployedContract,
    resolveMessageActions,
    shareProject,
    cloneProject,
    cloneSharedProject,
  }

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  )
}

export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext)
  if (!ctx) throw new Error('useProjects must be used within ProjectsProvider')
  return ctx
}
