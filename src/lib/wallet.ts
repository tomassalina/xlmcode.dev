export type StoredWallet = { publicKey: string; secret: string }
export type DerivedAccount = { index: number; publicKey: string; secret: string; balance?: string }
export type ProjectWallet = { index: number; publicKey: string; secret: string; label: string; balance?: string }

/** Create a fresh BIP-39 seed phrase. */
export async function createSeed(): Promise<string> {
  const res = await fetch('/api/wallet/seed', { method: 'POST' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `createSeed failed: ${res.status}`)
  return (data as { mnemonic: string }).mnemonic
}

/** Derive account at index from mnemonic; optionally Friendbot-fund it. */
export async function deriveAccount(mnemonic: string, index: number, fund?: boolean): Promise<DerivedAccount> {
  const res = await fetch('/api/wallet/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mnemonic, index, fund }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `deriveAccount failed: ${res.status}`)
  return data as DerivedAccount
}

/** Friendbot-fund an account, return new balance. */
export async function fundAccount(publicKey: string): Promise<string> {
  const res = await fetch('/api/wallet/fund', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ publicKey }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `fundAccount failed: ${res.status}`)
  return (data as { publicKey: string; balance: string }).balance
}

/** Fetch native XLM balance. */
export async function getBalance(address: string): Promise<string> {
  const res = await fetch(`/api/wallet/balance?address=${encodeURIComponent(address)}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `getBalance failed: ${res.status}`)
  return (data as { address: string; balance: string }).balance
}
