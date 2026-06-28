import type { VercelRequest, VercelResponse } from '@vercel/node'
import { deriveAccount, fundWallet, getBalance } from '../_lib/wallet'

/**
 * POST /api/wallet/account { mnemonic, index, fund? }
 * Derive the account at `index` (SEP-0005) and optionally Friendbot-fund it.
 * Returns { index, publicKey, secret, balance }. The mnemonic is used in-memory
 * only — never persisted.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  try {
    const { mnemonic, index, fund } = req.body as {
      mnemonic: string
      index: number
      fund?: boolean
    }
    if (!mnemonic || typeof index !== 'number') {
      return res.status(400).json({ error: 'mnemonic and index required' })
    }
    const acct = deriveAccount(mnemonic, index)
    if (fund) await fundWallet(acct.publicKey)
    res.status(200).json({ ...acct, balance: await getBalance(acct.publicKey) })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' })
  }
}
