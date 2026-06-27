import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ChatMessage, FileTree } from '../../shared/types'
import { sendChat } from '../lib/api'
import { applyFileOps, initialFileTree } from '../lib/project'

/**
 * In-memory project store. Lives above the router so project state survives
 * navigation between the landing (/) and the editor (/projects/:slug).
 *
 * Not persisted — a hard refresh loses projects. Supabase persistence is
 * Milestone 5; until then this is a single-session store.
 */
export interface ProjectState {
  slug: string
  name: string
  messages: ChatMessage[]
  fileTree: FileTree
  busy: boolean
  error: string | null
}

interface ProjectsContextValue {
  getProject: (slug: string) => ProjectState | undefined
  /** Create a project from the first prompt, kick off generation, return its slug. */
  createProject: (prompt: string) => string
  /** Create a project from predefined files (no LLM call), return its slug. */
  createFromFiles: (name: string, files: FileTree) => string
  /** Send a follow-up message in an existing project. */
  send: (slug: string, text: string) => void
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

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const sessionId = useRef(crypto.randomUUID()).current
  const [, force] = useState(0)
  // Ref is the source of truth for async reads; state bump triggers re-render.
  const ref = useRef<Record<string, ProjectState>>({})

  const commit = (next: Record<string, ProjectState>) => {
    ref.current = next
    force((n) => n + 1)
  }

  const patch = (slug: string, partial: Partial<ProjectState>) => {
    const current = ref.current[slug]
    if (!current) return
    commit({ ...ref.current, [slug]: { ...current, ...partial } })
  }

  const send = async (slug: string, text: string) => {
    const p = ref.current[slug]
    if (!p || p.busy) return
    const history = p.messages
    patch(slug, {
      messages: [...history, { role: 'user', content: text }],
      busy: true,
      error: null,
    })
    try {
      const res = await sendChat({
        sessionId,
        fileTree: p.fileTree,
        history,
        userMessage: text,
      })
      const latest = ref.current[slug]
      patch(slug, {
        fileTree: applyFileOps(latest.fileTree, res.files),
        messages: [...latest.messages, { role: 'assistant', content: res.message }],
        busy: false,
      })
    } catch (err) {
      patch(slug, {
        busy: false,
        error: err instanceof Error ? err.message : 'Something went wrong',
      })
    }
  }

  const createProject = (prompt: string): string => {
    const id = crypto.randomUUID().slice(0, 6)
    const name = deriveName(prompt)
    const slug = `${kebab(name) || 'project'}-${id}`
    commit({
      ...ref.current,
      [slug]: {
        slug,
        name,
        messages: [],
        fileTree: initialFileTree(),
        busy: false,
        error: null,
      },
    })
    void send(slug, prompt)
    return slug
  }

  const createFromFiles = (name: string, files: FileTree): string => {
    const id = crypto.randomUUID().slice(0, 6)
    const slug = `${kebab(name) || 'project'}-${id}`
    commit({
      ...ref.current,
      [slug]: {
        slug,
        name,
        messages: [{ role: 'assistant', content: `Loaded "${name}".` }],
        fileTree: files,
        busy: false,
        error: null,
      },
    })
    return slug
  }

  const value: ProjectsContextValue = {
    getProject: (slug) => ref.current[slug],
    createProject,
    createFromFiles,
    send: (slug, text) => void send(slug, text),
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
