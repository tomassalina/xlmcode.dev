import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../../shared/types'
import { PromptInput } from './PromptInput'

/** Left column: conversation history + prompt box. */
export function ChatPanel({
  messages,
  busy,
  error,
  onSend,
}: {
  messages: ChatMessage[]
  busy: boolean
  error: string | null
  onSend: (text: string) => void
}) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  return (
    <section className="flex w-[400px] shrink-0 flex-col border-r border-zinc-800">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-[13px] text-zinc-500">
            <Spinner />
            Generating…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-[13px] text-red-300">
            {error}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="border-t border-zinc-800 p-4">
        <PromptInput onSend={onSend} busy={busy} />
      </div>
    </section>
  )
}

function Message({ role, content }: ChatMessage) {
  const isUser = role === 'user'
  return (
    <div className={isUser ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          isUser
            ? 'max-w-[85%] rounded-2xl rounded-br-sm bg-zinc-100 px-3.5 py-2 text-[13.5px] text-black'
            : 'max-w-[85%] rounded-2xl rounded-bl-sm bg-zinc-900 px-3.5 py-2 text-[13.5px] text-zinc-200'
        }
      >
        {content}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-300" />
  )
}
