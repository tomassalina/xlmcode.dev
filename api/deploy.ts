import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getManifest } from './_lib/contracts'
import { deployContract } from './_lib/deploy'

/**
 * POST /api/deploy — deploy a configurable contract to testnet.
 * Body: { manifestId: string, config: Record<string, unknown> }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { manifestId, config, deployerSecret } = req.body as {
      manifestId: string
      config: Record<string, unknown>
      deployerSecret?: string
    }
    const manifest = await getManifest(manifestId)
    if (!manifest) return res.status(404).json({ error: `Unknown contract: ${manifestId}` })

    const result = await deployContract({
      manifest,
      config: config ?? {},
      deployerSecret,
    })
    res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
