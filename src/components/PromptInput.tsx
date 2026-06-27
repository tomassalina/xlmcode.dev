import { useRef, useState, type KeyboardEvent } from 'react'

/** Auto-clearing prompt box. Enter sends, Shift+Enter newlines.
 *  Type `@` to reference a file from the project (autocomplete over filePaths). */
export function PromptInput({
  onSend,
  busy,
  placeholder = 'Describe the app you want to build…',
  autoFocus,
  filePaths = [],
}: {
  onSend: (text: string) => void
  busy: boolean
  placeholder?: string
  autoFocus?: boolean
  filePaths?: string[]
}) {
  const [value, setValue] = useState('')
  const taRef = useRef<HTMLTextAreaElement>(null)
  // Active @-mention being typed: the query and where the '@' starts.
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  )

  const matches =
    mention && filePaths.length
      ? filePaths
          .filter((p) => p.toLowerCase().includes(mention.query.toLowerCase()))
          .slice(0, 6)
      : []

  const refreshMention = (text: string, caret: number) => {
    const before = text.slice(0, caret)
    const at = before.lastIndexOf('@')
    if (at === -1 || /\s/.test(before.slice(at + 1))) return setMention(null)
    setMention({ query: before.slice(at + 1), start: at })
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    refreshMention(e.target.value, e.target.selectionStart)
  }

  const insertMention = (path: string) => {
    if (!mention) return
    const caret = taRef.current?.selectionStart ?? value.length
    const next = `${value.slice(0, mention.start)}@${path} ${value.slice(caret)}`
    setValue(next)
    setMention(null)
    requestAnimationFrame(() => taRef.current?.focus())
  }

  const submit = () => {
    const text = value.trim()
    if (!text || busy) return
    setValue('')
    setMention(null)
    onSend(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention && matches.length) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(matches[0])
        return
      }
      if (e.key === 'Escape') {
        setMention(null)
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-2 transition-colors focus-within:border-zinc-700">
      {mention && matches.length > 0 && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-72 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl">
          {matches.map((p, i) => (
            <button
              key={p}
              onClick={() => insertMention(p)}
              className={`block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[12.5px] ${
                i === 0
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
              }`}
            >
              <span className="text-zinc-600">@</span>
              {p}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={taRef}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder={placeholder}
        className="max-h-40 w-full select-text resize-none bg-transparent px-2 py-1.5 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] text-zinc-600">
          ↵ to send · ⇧↵ newline{filePaths.length ? ' · @ to reference a file' : ''}
        </span>
        <button
          onClick={submit}
          disabled={busy || !value.trim()}
          className="rounded-full bg-zinc-50 px-3.5 py-1.5 text-[13px] font-medium text-black transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {busy ? 'Working…' : 'Send'}
        </button>
      </div>
    </div>
  )
}
