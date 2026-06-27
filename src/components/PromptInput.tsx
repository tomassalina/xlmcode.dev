import { useState, type KeyboardEvent } from 'react'

/** Auto-clearing prompt box. Enter sends, Shift+Enter newlines. */
export function PromptInput({
  onSend,
  busy,
  placeholder = 'Describe the app you want to build…',
  autoFocus,
}: {
  onSend: (text: string) => void
  busy: boolean
  placeholder?: string
  autoFocus?: boolean
}) {
  const [value, setValue] = useState('')

  const submit = () => {
    const text = value.trim()
    if (!text || busy) return
    setValue('')
    onSend(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-2 transition-colors focus-within:border-zinc-700">
      <textarea
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder={placeholder}
        className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-[14px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
      <div className="flex items-center justify-between px-1 pt-1">
        <span className="text-[11px] text-zinc-600">↵ to send · ⇧↵ newline</span>
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
