import type { VercelRequest, VercelResponse } from '@vercel/node'
import { generateMnemonic } from '../_lib/wallet'

/** POST /api/wallet/seed — generate a fresh 12-word seed phrase.
 *  The client stores it (localStorage); we never persist it. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    res.status(200).json({ mnemonic: generateMnemonic() })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
