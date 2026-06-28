/**
 * Per-user HD wallet (server helpers). SEP-0005 derivation.
 *
 * The user holds ONE seed phrase (held client-side in localStorage, exportable).
 * Accounts are derived deterministically by index (m/44'/148'/n') — index 0 is
 * the main account, 1..N are per-project test wallets. The same seed + index
 * yields the same account on any device, so cross-device sync only needs the
 * per-project index/label metadata (Supabase, Etapa 5) — never a secret.
 *
 * The seed only transits to the server to derive an account; it is never
 * persisted server-side. Derived secrets are cached client-side. Testnet only.
 */
import { rpc } from '@stellar/stellar-sdk'
import StellarHDWallet from 'stellar-hd-wallet'

const RPC_URL = 'https://soroban-testnet.stellar.org'
const FRIENDBOT = 'https://friendbot.stellar.org'
const HORIZON = 'https://horizon-testnet.stellar.org'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Fund an address via Friendbot, then wait until the RPC sees the account. */
export async function fundWallet(publicKey: string): Promise<void> {
  const fb = await fetch(`${FRIENDBOT}?addr=${publicKey}`)
  // Friendbot returns 400 if the account already exists — that's fine.
  if (!fb.ok && fb.status !== 400) throw new Error(`friendbot failed: ${fb.status}`)
  const server = new rpc.Server(RPC_URL)
  for (let i = 0; i < 30; i++) {
    try {
      await server.getAccount(publicKey)
      return
    } catch {
      await sleep(1000)
    }
  }
  throw new Error('funded account never became visible on RPC')
}

/** Generate a fresh 12-word BIP-39 seed phrase (the client stores it). */
export function generateMnemonic(): string {
  return StellarHDWallet.generateMnemonic({ entropyBits: 128 })
}

/** Derive the account at `index` from a seed phrase (SEP-0005, m/44'/148'/n'). */
export function deriveAccount(
  mnemonic: string,
  index: number,
): { index: number; publicKey: string; secret: string } {
  const w = StellarHDWallet.fromMnemonic(mnemonic)
  return { index, publicKey: w.getPublicKey(index), secret: w.getSecret(index) }
}

/** Native XLM balance for an address (via Horizon). Returns '0' if not funded. */
export async function getBalance(publicKey: string): Promise<string> {
  const res = await fetch(`${HORIZON}/accounts/${publicKey}`)
  if (res.status === 404) return '0'
  if (!res.ok) throw new Error(`horizon failed: ${res.status}`)
  const data = (await res.json()) as {
    balances: { asset_type: string; balance: string }[]
  }
  const native = data.balances.find((b) => b.asset_type === 'native')
  return native?.balance ?? '0'
}
