import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fundWallet, getBalance } from '../_lib/wallet'

/** POST /api/wallet/fund { publicKey } — top up a testnet account via Friendbot. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { publicKey } = req.body as { publicKey: string }
    if (!publicKey) return res.status(400).json({ error: 'publicKey required' })
    await fundWallet(publicKey)
    res.status(200).json({ publicKey, balance: await getBalance(publicKey) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
