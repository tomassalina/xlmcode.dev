import { useEffect, useRef, useState } from 'react'
import {
  Check,
  FilePlus2,
  FilePen,
  Trash2,
  Pencil,
  Copy,
  ChevronRight,
  ChevronDown,
  Coins,
  Wallet,
  Loader2,
} from 'lucide-react'
import type { AgentAction, ChatMessage } from '../../shared/types'
import type { Activity } from '../lib/api'
import { PromptInput } from './PromptInput'

/** Left column: header (chat name) + conversation history + live activity + input. */
export function ChatPanel({
  projectName,
  onRename,
  messages,
  busy,
  error,
  activity,
  streamingMessage,
  filePaths,
  onSend,
  onRunActions,
  onSkipActions,
}: {
  projectName: string
  onRename: (name: string) => void
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  activity: Activity[]
  streamingMessage: string
  filePaths: string[]
  onSend: (text: string) => void
  onRunActions: (messageIndex: number, actions: AgentAction[]) => Promise<void>
  onSkipActions: (messageIndex: number) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)
  const [renaming, setRenaming] = useState(false)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, activity, streamingMessage])

  return (
    <section className="flex h-full flex-col">
      {/* Header — same height as the workspace tabs row */}
      <header className="flex shrink-0 items-center border-b border-zinc-800 px-3 py-2.5">
        <button
          onClick={() => setRenaming(true)}
          title="Rename chat"
          className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-zinc-200 transition-colors hover:bg-zinc-900"
        >
          <span className="truncate font-medium">{projectName}</span>
          <Pencil className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        </button>
      </header>

      {renaming && (
        <RenameModal
          current={projectName}
          onClose={() => setRenaming(false)}
          onSave={(name) => {
            onRename(name)
            setRenaming(false)
          }}
        />
      )}

      <div className="flex-1 select-text space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <Message
            key={i}
            {...m}
            messageIndex={i}
            onRunActions={onRunActions}
            onSkipActions={onSkipActions}
          />
        ))}
        {busy && (
          <ThinkingTrace activity={activity} message={streamingMessage} />
        )}
        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <PromptInput onSend={onSend} busy={busy} filePaths={filePaths} />
      </div>
    </section>
  )
}

function timeAgo(ts?: number): string {
  if (!ts) return ''
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000)
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
}

function CopyButton({ text, light }: { text: string; light?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      title="Copy message"
      className={`rounded p-1 transition-colors ${
        light
          ? 'text-zinc-400 hover:text-zinc-600'
          : 'text-zinc-500 hover:text-zinc-200'
      }`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function Message({
  role,
  content,
  files,
  versionName,
  createdAt,
  stats,
  actions,
  actionsDone,
  kind,
  messageIndex,
  onRunActions,
  onSkipActions,
}: ChatMessage & {
  messageIndex: number
  onRunActions: (messageIndex: number, actions: AgentAction[]) => Promise<void>
  onSkipActions: (messageIndex: number) => void
}) {
  const isUser = role === 'user'
  const [expanded, setExpanded] = useState(false)
  const long = content.length > 300 || content.split('\n').length > 6

  // System messages render as a subtle centered note, not a bubble.
  if (kind === 'system') {
    return (
      <div className="flex justify-center px-4 py-1">
        <span className="text-center text-[12px] text-zinc-500">{content}</span>
      </div>
    )
  }

  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div className={`flex w-full flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`max-w-[90%] rounded-2xl px-3.5 py-2 text-[13.5px] ${
            isUser
              ? 'rounded-br-sm bg-zinc-100 text-black'
              : 'rounded-bl-sm bg-zinc-900 text-zinc-200'
          }`}
        >
          {!isUser && versionName && (
            <div className="mb-1 text-[11px] font-medium text-zinc-500">
              {versionName}
            </div>
          )}
          <div
            className={`whitespace-pre-wrap ${
              long && !expanded ? 'max-h-28 overflow-hidden' : ''
            }`}
          >
            {content}
          </div>
          {long && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 text-[12px] font-medium text-zinc-500 hover:opacity-80"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>

        {/* Action cards — shown when the assistant proposed actions and they haven't been resolved. */}
        {actions && actions.length > 0 && !actionsDone && (
          <ActionCards
            actions={actions}
            messageIndex={messageIndex}
            onRun={onRunActions}
            onSkip={onSkipActions}
          />
        )}

        {/* Footer: agent → "Worked for" summary; both → timestamp + copy (bottom-right) */}
        {stats ? (
          <WorkedFor
            stats={stats}
            files={files}
            createdAt={createdAt}
            content={content}
          />
        ) : (
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-zinc-600">
            {createdAt && <span>{timeAgo(createdAt)}</span>}
            <CopyButton text={content} />
          </div>
        )}
      </div>
    </div>
  )
}

/** Renders a card per proposed action with a shared Confirm / Skip footer. */
function ActionCards({
  actions,
  messageIndex,
  onRun,
  onSkip,
}: {
  actions: AgentAction[]
  messageIndex: number
  onRun: (messageIndex: number, actions: AgentAction[]) => Promise<void>
  onSkip: (messageIndex: number) => void
}) {
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setRunning(true)
    setRunError(null)
    try {
      await onRun(messageIndex, actions)
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="w-full max-w-[90%] space-y-2">
      {actions.map((action, i) => (
        <ActionCard key={i} action={action} />
      ))}
      {runError && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[12px] text-red-300">
          {runError}
        </div>
      )}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => void handleConfirm()}
          disabled={running}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-100 px-3.5 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:bg-white disabled:opacity-50"
        >
          {running ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running…
            </>
          ) : (
            'Confirm'
          )}
        </button>
        <button
          onClick={() => onSkip(messageIndex)}
          disabled={running}
          className="rounded-lg px-3.5 py-1.5 text-[12.5px] text-zinc-400 transition-colors hover:text-zinc-100 disabled:opacity-50"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

function ActionCard({ action }: { action: AgentAction }) {
  if (action.type === 'deploy_contract') {
    let configEntries: [string, unknown][] = []
    try {
      const parsed = JSON.parse(action.configJson) as Record<string, unknown>
      configEntries = Object.entries(parsed)
    } catch {
      // configJson unparseable — show nothing
    }
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-[12.5px]">
        <div className="flex items-center gap-2 text-zinc-200">
          <Coins className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className="font-medium">Deploy contract</span>
          <code className="ml-auto truncate text-[11.5px] text-zinc-400">{action.manifestId}</code>
        </div>
        <p className="mt-1.5 text-zinc-400">{action.reason}</p>
        {configEntries.length > 0 && (
          <ul className="mt-2 space-y-0.5 border-t border-zinc-800 pt-2">
            {configEntries.map(([k, v]) => (
              <li key={k} className="flex items-center gap-1.5 text-[11.5px]">
                <span className="text-zinc-500">{k}:</span>
                <span className="text-zinc-300">{String(v)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // create_wallet
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-3 text-[12.5px]">
      <div className="flex items-center gap-2 text-zinc-200">
        <Wallet className="h-4 w-4 shrink-0 text-zinc-400" />
        <span className="font-medium">Create test wallet</span>
        <code className="ml-auto truncate text-[11.5px] text-zinc-400">{action.label}</code>
      </div>
      <p className="mt-1.5 text-zinc-400">{action.reason}</p>
    </div>
  )
}

/** v0-style collapsible "Worked for {time}" footer for assistant turns. */
function WorkedFor({
  stats,
  files,
  createdAt,
  content,
}: {
  stats: NonNullable<ChatMessage['stats']>
  files?: ChatMessage['files']
  createdAt?: number
  content: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="w-full max-w-[90%] overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11.5px] text-zinc-500">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 hover:text-zinc-300"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          <Check className="h-3.5 w-3.5 text-emerald-500/80" />
          Worked for {fmtDuration(stats.durationMs)}
        </button>
        {createdAt && <span className="text-zinc-600">· {timeAgo(createdAt)}</span>}
        <div className="ml-auto">
          <CopyButton text={content} />
        </div>
      </div>
      {open && (
        <div className="space-y-1.5 border-t border-zinc-800 px-3 py-2 text-[11.5px]">
          <Stat label="Files modified" value={`${stats.filesModified}`} />
          <Stat label="Lines changed" value={`+${stats.added} -${stats.removed}`} />
          {files && files.length > 0 && (
            <ul className="mt-1.5 space-y-1 border-t border-zinc-800 pt-2">
              {files.map((a, i) => {
                const Icon = OP_ICON[a.op]
                return (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 text-[11.5px] text-zinc-500"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{VERB[a.op]}</span>
                    <code className="truncate text-zinc-400">{a.path}</code>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  )
}

const VERB: Record<Activity['op'], string> = {
  create: 'Creating',
  edit: 'Editing',
  delete: 'Deleting',
}
const OP_ICON = { create: FilePlus2, edit: FilePen, delete: Trash2 }

/** v0-style live trace: streaming message + a list of files being touched. */
function ThinkingTrace({
  activity,
  message,
}: {
  activity: Activity[]
  message: string
}) {
  return (
    <div className="flex flex-col gap-2">
      {message && (
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3.5 py-2 text-[13.5px] whitespace-pre-wrap text-zinc-200">
          {message}
        </div>
      )}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5">
        {activity.length === 0 ? (
          <div className="flex items-center gap-2 text-[12.5px] text-zinc-500">
            <Spinner />
            Thinking…
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activity.map((a, i) => {
              const last = i === activity.length - 1
              const Icon = OP_ICON[a.op]
              return (
                <li key={i} className="flex items-center gap-2 text-[12.5px]">
                  {last ? (
                    <Spinner />
                  ) : (
                    <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                  <span className="text-zinc-500">{VERB[a.op]}</span>
                  <code className="truncate text-zinc-300">{a.path}</code>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
  )
}

/** Centered modal to rename the current chat/project. */
function RenameModal({
  current,
  onClose,
  onSave,
}: {
  current: string
  onClose: () => void
  onSave: (name: string) => void
}) {
  const [value, setValue] = useState(current)
  const save = () => {
    if (value.trim()) onSave(value)
  }
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium">Rename chat</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') onClose()
          }}
          className="mt-4 w-full select-text rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[14px] text-zinc-100 outline-none focus:border-zinc-600"
        />
        <div className="mt-5 flex justify-end gap-2 text-[13px]">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!value.trim()}
            className="rounded-lg bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
