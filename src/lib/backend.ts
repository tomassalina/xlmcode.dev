const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8787'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class RateLimitError extends Error {
  constructor() {
    super('Daily rate limit reached. Try again tomorrow.')
    this.name = 'RateLimitError'
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) message = body.error
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

export async function streamChat(
  projectId: string,
  body: { userMessage: string; history?: unknown[]; fileTree?: unknown; modelType?: string },
  onChunk: (chunk: string) => void,
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/projects/${projectId}/chat`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (res.status === 429) throw new RateLimitError()
  if (!res.ok || !res.body) {
    let message = `Chat request failed (${res.status})`
    try {
      const b = await res.json() as { error?: string }
      if (b.error) message = b.error
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    full += chunk
    onChunk(chunk)
  }
  return full
}
