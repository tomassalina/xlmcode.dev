import type { AgentResponse, ChatMessage, FileTree } from '../../shared/types'

/**
 * Calls POST /api/chat and returns the validated AgentResponse. The backend
 * already validates against the Zod schema, so a 200 means the shape is good.
 */
export async function sendChat(params: {
  sessionId: string
  fileTree: FileTree
  history: ChatMessage[]
  userMessage: string
}): Promise<AgentResponse> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ provider: 'openai', projectId: 'dev', ...params }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }

  return res.json() as Promise<AgentResponse>
}
