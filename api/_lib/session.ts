import type { LlmProvider } from '../../shared/types'

/**
 * BYOK session store (PLAN.md §7).
 *
 * The user's LLM API key lives ONLY in server memory, keyed by session, and is
 * never persisted — not to disk, not to Supabase, not to the file tree. If the
 * serverless instance restarts the user re-enters it. If nothing is stored,
 * there is nothing to steal.
 *
 * Note: serverless memory is not shared across Vercel instances. Acceptable for
 * the MVP (demo, few users). A cross-instance encrypted store is post-MVP only.
 */
interface StoredKey {
  provider: LlmProvider
  apiKey: string
  ts: number
}

const keys = new Map<string, StoredKey>()

const keyOf = (sessionId: string, provider: LlmProvider) =>
  `${sessionId}:${provider}`

export function setSessionKey(
  sessionId: string,
  provider: LlmProvider,
  apiKey: string,
): void {
  keys.set(keyOf(sessionId, provider), { provider, apiKey, ts: Date.now() })
}

export function getSessionKey(
  sessionId: string,
  provider: LlmProvider,
): string | null {
  return keys.get(keyOf(sessionId, provider))?.apiKey ?? null
}

export function clearSessionKey(
  sessionId: string,
  provider: LlmProvider,
): void {
  keys.delete(keyOf(sessionId, provider))
}
