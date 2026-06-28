import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * GET /api/health — liveness probe. Confirms the serverless layer is wired up.
 * Replaced by real endpoints (chat, deploy, contracts) in later milestones.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({ ok: true, service: 'xlmcode-api', milestone: 0 })
}
