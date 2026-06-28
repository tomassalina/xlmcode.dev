import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getBalance } from '../_lib/wallet'

/** GET /api/wallet/balance?address=G... — native XLM balance. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const address = String(req.query.address ?? '')
    if (!address) return res.status(400).json({ error: 'address required' })
    res.status(200).json({ address, balance: await getBalance(address) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
