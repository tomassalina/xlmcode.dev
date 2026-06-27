import type { VercelRequest, VercelResponse } from '@vercel/node'
import { runChat } from './_lib/llm'
import { getSessionKey } from './_lib/session'
import type { ChatRequest } from '../shared/types'

/**
 * POST /api/chat — the heart of the platform.
 *
 * Thin adapter: pulls the BYOK key from the in-memory session (falling back to
 * the dev env key locally), delegates to runChat, returns the validated
 * AgentResponse.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { sessionId, provider, fileTree, history, userMessage } =
      req.body as ChatRequest

    // BYOK lives in session memory, never persisted. Dev fallback to env key.
    const apiKey =
      getSessionKey(sessionId, provider) ?? process.env.OPENAI_API_KEY ?? null
    if (!apiKey) {
      return res.status(401).json({ error: 'No API key for this session' })
    }

    const result = await runChat({ apiKey, fileTree, history, userMessage })
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: message })
  }
}
