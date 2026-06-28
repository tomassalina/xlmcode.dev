/* eslint-disable react-refresh/only-export-components --
   Context file: the provider and its hook are intentionally co-located. The
   rule is a dev-only fast-refresh hint and does not affect runtime. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from 'react'
import { useAuth } from '../auth/store'
import {
  createSeed,
  deriveAccount,
  fundAccount,
  getBalance,
  type StoredWallet,
  type ProjectWallet,
} from '../lib/wallet'

export const MAX_PROJECT_WALLETS = 5

// ── Context value ─────────────────────────────────────────────────────────────

interface WalletValue {
  wallet: StoredWallet | null
  mnemonic: string | null
  balance: string | null
  provisioning: boolean
  error: string | null
  ensureWallet: () => Promise<StoredWallet>
  fund: () => Promise<void>
  refreshBalance: () => Promise<void>
  projectWallets: (slug: string) => ProjectWallet[]
  addProjectWallet: (slug: string, label?: string) => Promise<ProjectWallet>
  fundProjectWallet: (slug: string, index: number) => Promise<void>
  refreshProjectBalances: (slug: string) => Promise<void>
}

const WalletContext = createContext<WalletValue | null>(null)

// ── State ─────────────────────────────────────────────────────────────────────

interface WalletState {
  wallet: StoredWallet | null
  mnemonic: string | null
  balance: string | null
  provisioning: boolean
  error: string | null
  projectWalletsBySlug: Record<string, ProjectWallet[]>
}

type WalletAction =
  | { type: 'reset' }
  | { type: 'load'; wallet: StoredWallet; mnemonic: string }
  | { type: 'provisioning' }
  | { type: 'provisioned'; wallet: StoredWallet; mnemonic: string; balance: string }
  | { type: 'provision_error'; error: string }
  | { type: 'balance'; balance: string }
  | { type: 'sync_project_wallets'; slug: string; wallets: ProjectWallet[] }
  | { type: 'update_project_wallet'; slug: string; index: number; balance: string }

const INIT: WalletState = {
  wallet: null,
  mnemonic: null,
  balance: null,
  provisioning: false,
  error: null,
  projectWalletsBySlug: {},
}

function reducer(state: WalletState, action: WalletAction): WalletState {
  switch (action.type) {
    case 'reset':
      return INIT
    case 'load':
      return { ...state, wallet: action.wallet, mnemonic: action.mnemonic, error: null }
    case 'provisioning':
      return { ...state, provisioning: true, error: null }
    case 'provisioned':
      return {
        ...state,
        provisioning: false,
        wallet: action.wallet,
        mnemonic: action.mnemonic,
        balance: action.balance,
      }
    case 'provision_error':
      return { ...state, provisioning: false, error: action.error }
    case 'balance':
      return { ...state, balance: action.balance }
    case 'sync_project_wallets':
      return {
        ...state,
        projectWalletsBySlug: {
          ...state.projectWalletsBySlug,
          [action.slug]: action.wallets,
        },
      }
    case 'update_project_wallet': {
      const existing = state.projectWalletsBySlug[action.slug] ?? []
      return {
        ...state,
        projectWalletsBySlug: {
          ...state.projectWalletsBySlug,
          [action.slug]: existing.map((w) =>
            w.index === action.index ? { ...w, balance: action.balance } : w,
          ),
        },
      }
    }
  }
}

// ── localStorage types ────────────────────────────────────────────────────────

type SeedRecord = { mnemonic: string; nextIndex: number }
type AccountCache = Record<number, { index: number; publicKey: string; secret: string; label: string }>

// ── localStorage helpers (private) ────────────────────────────────────────────

function seedKey(email: string) {
  return `xlmcode-seed:${email}`
}

function accountsKey(email: string) {
  return `xlmcode-accounts:${email}`
}

function projectKey(email: string, slug: string) {
  return `xlmcode-project-wallets:${email}:${slug}`
}

function readSeedRecord(email: string): SeedRecord | null {
  try {
    const raw = localStorage.getItem(seedKey(email))
    return raw ? (JSON.parse(raw) as SeedRecord) : null
  } catch {
    return null
  }
}

function writeSeedRecord(email: string, record: SeedRecord) {
  localStorage.setItem(seedKey(email), JSON.stringify(record))
}

function readAccountCache(email: string): AccountCache {
  try {
    const raw = localStorage.getItem(accountsKey(email))
    return raw ? (JSON.parse(raw) as AccountCache) : {}
  } catch {
    return {}
  }
}

function writeAccountCache(email: string, cache: AccountCache) {
  localStorage.setItem(accountsKey(email), JSON.stringify(cache))
}

function readProjectIndices(email: string, slug: string): number[] {
  try {
    const raw = localStorage.getItem(projectKey(email, slug))
    return raw ? (JSON.parse(raw) as number[]) : []
  } catch {
    return []
  }
}

function writeProjectIndices(email: string, slug: string, indices: number[]) {
  localStorage.setItem(projectKey(email, slug), JSON.stringify(indices))
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, dispatch] = useReducer(reducer, INIT)

  const provisioningRef = useRef(false)
  const initializedFor = useRef<string | null>(null)

  const refreshBalance = useCallback(async () => {
    if (!state.wallet) return
    try {
      const b = await getBalance(state.wallet.publicKey)
      dispatch({ type: 'balance', balance: b })
    } catch {
      // Non-fatal — balance stays stale.
    }
  }, [state.wallet])

  const ensureWallet = useCallback(async (): Promise<StoredWallet> => {
    if (!user) throw new Error('No authenticated user')

    const seedRecord = readSeedRecord(user.email)

    if (seedRecord) {
      // Seed exists — derive index 0 deterministically (no fund flag needed)
      const derived = await deriveAccount(seedRecord.mnemonic, 0)
      const wallet: StoredWallet = { publicKey: derived.publicKey, secret: derived.secret }

      // Cache account at index 0
      const cache = readAccountCache(user.email)
      if (!cache[0]) {
        cache[0] = { index: 0, publicKey: derived.publicKey, secret: derived.secret, label: 'Main account' }
        writeAccountCache(user.email, cache)
      }

      dispatch({ type: 'load', wallet, mnemonic: seedRecord.mnemonic })

      try {
        const b = await getBalance(wallet.publicKey)
        dispatch({ type: 'balance', balance: b })
      } catch {
        // balance fetch can fail harmlessly
      }

      return wallet
    }

    if (provisioningRef.current) {
      // Already provisioning — wait for localStorage to be populated.
      return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
          const record = readSeedRecord(user.email)
          if (record) {
            clearInterval(interval)
            const cache = readAccountCache(user.email)
            const entry = cache[0]
            if (entry) {
              resolve({ publicKey: entry.publicKey, secret: entry.secret })
            } else {
              reject(new Error('Provisioning failed: no account cached'))
            }
            return
          }
          if (!provisioningRef.current) {
            clearInterval(interval)
            reject(new Error('Provisioning failed'))
          }
        }, 200)
      })
    }

    provisioningRef.current = true
    dispatch({ type: 'provisioning' })

    try {
      const mnemonic = await createSeed()
      writeSeedRecord(user.email, { mnemonic, nextIndex: 1 })

      const derived = await deriveAccount(mnemonic, 0, true)
      const wallet: StoredWallet = { publicKey: derived.publicKey, secret: derived.secret }

      const cache = readAccountCache(user.email)
      cache[0] = { index: 0, publicKey: derived.publicKey, secret: derived.secret, label: 'Main account' }
      writeAccountCache(user.email, cache)

      const balance = derived.balance ?? ''
      dispatch({ type: 'provisioned', wallet, mnemonic, balance })
      return wallet
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'provision_error', error: msg })
      throw e
    } finally {
      provisioningRef.current = false
    }
  }, [user])

  const fund = useCallback(async () => {
    if (!state.wallet) return
    try {
      const balance = await fundAccount(state.wallet.publicKey)
      dispatch({ type: 'balance', balance })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      dispatch({ type: 'provision_error', error: msg })
    }
  }, [state.wallet])

  const projectWallets = useCallback(
    (slug: string): ProjectWallet[] => {
      const cached = state.projectWalletsBySlug[slug]
      if (cached) return cached
      if (!user) return []

      const indices = readProjectIndices(user.email, slug)
      if (indices.length === 0) return []

      const accounts = readAccountCache(user.email)
      const wallets = indices
        .map((i) => accounts[i])
        .filter(Boolean)
        .map((a) => ({ ...a }))

      if (wallets.length > 0) {
        dispatch({ type: 'sync_project_wallets', slug, wallets })
      }

      return wallets
    },
    [state.projectWalletsBySlug, user],
  )

  const addProjectWallet = useCallback(
    async (slug: string, label?: string): Promise<ProjectWallet> => {
      if (!user) throw new Error('No authenticated user')
      if (!state.mnemonic) throw new Error('No seed phrase available')

      const indices = readProjectIndices(user.email, slug)
      if (indices.length >= MAX_PROJECT_WALLETS) {
        throw new Error('Maximum of 5 project wallets reached')
      }

      const seedRecord = readSeedRecord(user.email)
      if (!seedRecord) throw new Error('No seed record found')

      const nextIndex = seedRecord.nextIndex
      const count = indices.length

      const derived = await deriveAccount(state.mnemonic, nextIndex, true)
      const resolvedLabel = label ?? `Wallet ${count + 1}`

      // Save account to cache
      const cache = readAccountCache(user.email)
      cache[nextIndex] = {
        index: nextIndex,
        publicKey: derived.publicKey,
        secret: derived.secret,
        label: resolvedLabel,
      }
      writeAccountCache(user.email, cache)

      // Append index to project list
      const updatedIndices = [...indices, nextIndex]
      writeProjectIndices(user.email, slug, updatedIndices)

      // Increment nextIndex in seed record
      writeSeedRecord(user.email, { mnemonic: seedRecord.mnemonic, nextIndex: nextIndex + 1 })

      const newWallet: ProjectWallet = {
        index: nextIndex,
        publicKey: derived.publicKey,
        secret: derived.secret,
        label: resolvedLabel,
        balance: derived.balance,
      }

      // Build full updated list for dispatch
      const updatedWallets = updatedIndices
        .map((i) => (i === nextIndex ? newWallet : cache[i] ? { ...cache[i] } : null))
        .filter((w): w is ProjectWallet => w !== null)

      dispatch({ type: 'sync_project_wallets', slug, wallets: updatedWallets })

      return newWallet
    },
    [user, state.mnemonic],
  )

  const fundProjectWallet = useCallback(
    async (slug: string, index: number): Promise<void> => {
      if (!user) throw new Error('No authenticated user')

      const cache = readAccountCache(user.email)
      const account = cache[index]
      if (!account) throw new Error(`Account at index ${index} not found`)

      const balance = await fundAccount(account.publicKey)

      // Update balance in cache
      cache[index] = { ...account }
      writeAccountCache(user.email, cache)

      dispatch({ type: 'update_project_wallet', slug, index, balance })
    },
    [user],
  )

  const refreshProjectBalances = useCallback(
    async (slug: string): Promise<void> => {
      if (!user) return

      const indices = readProjectIndices(user.email, slug)
      if (indices.length === 0) return

      const cache = readAccountCache(user.email)

      await Promise.all(
        indices.map(async (index) => {
          const account = cache[index]
          if (!account) return
          try {
            const balance = await getBalance(account.publicKey)
            dispatch({ type: 'update_project_wallet', slug, index, balance })
          } catch {
            // Non-fatal — balance stays stale for this account.
          }
        }),
      )
    },
    [user],
  )

  // Auto-provision on mount / when the user changes.
  useEffect(() => {
    if (!user) {
      dispatch({ type: 'reset' })
      initializedFor.current = null
      return
    }
    if (initializedFor.current === user.email) return
    initializedFor.current = user.email

    const seedRecord = readSeedRecord(user.email)
    if (seedRecord) {
      const cache = readAccountCache(user.email)
      const entry = cache[0]
      if (entry) {
        const wallet: StoredWallet = { publicKey: entry.publicKey, secret: entry.secret }
        dispatch({ type: 'load', wallet, mnemonic: seedRecord.mnemonic })
        getBalance(wallet.publicKey)
          .then((b) => dispatch({ type: 'balance', balance: b }))
          .catch(() => {})
      } else {
        void ensureWallet().catch(() => {})
      }
    } else {
      void ensureWallet().catch(() => {})
    }
  }, [user, ensureWallet])

  return (
    <WalletContext.Provider
      value={{
        wallet: state.wallet,
        mnemonic: state.mnemonic,
        balance: state.balance,
        provisioning: state.provisioning,
        error: state.error,
        ensureWallet,
        fund,
        refreshBalance,
        projectWallets,
        addProjectWallet,
        fundProjectWallet,
        refreshProjectBalances,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet(): WalletValue {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
