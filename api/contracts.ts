import type { VercelRequest, VercelResponse } from '@vercel/node'
import { listManifests } from './_lib/contracts'

/** GET /api/contracts — the deployable + connectable contract catalog. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    res.status(200).json({ contracts: await listManifests() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
