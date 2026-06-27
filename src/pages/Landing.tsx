import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PromptInput } from '../components/PromptInput'
import { useProjects } from '../projects/store'
import { EXAMPLE_APPS } from '../lib/project'

/** Route "/" — v0-style empty state: one centered prompt, a few starters. */
export function Landing() {
  const navigate = useNavigate()
  const { createProject, createFromFiles } = useProjects()
  const [busy, setBusy] = useState(false)

  // Free-text prompt → LLM generates.
  const startWithPrompt = (text: string) => {
    setBusy(true)
    navigate(`/projects/${createProject(text)}`)
  }

  // Example chip → load predefined files instantly, no LLM.
  const startWithExample = (label: string, files: Record<string, string>) => {
    navigate(`/projects/${createFromFiles(label, files)}`)
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-2xl -translate-y-8">
        <h1 className="mb-8 text-center text-3xl font-medium tracking-tight sm:text-4xl">
          What do you want to build?
        </h1>
        <PromptInput
          onSend={startWithPrompt}
          busy={busy}
          autoFocus
          placeholder="Describe a Stellar app in plain language…"
        />
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {EXAMPLE_APPS.map((ex) => (
            <button
              key={ex.label}
              onClick={() => startWithExample(ex.label, ex.files)}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-[12.5px] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200"
            >
              {ex.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}
