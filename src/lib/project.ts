import type { SandpackTheme } from '@codesandbox/sandpack-react'
import type { FileOp, FileTree } from '../../shared/types'

/**
 * The user's generated app lives as an in-memory FileTree. Sandpack (classic
 * `react-ts` template) renders it. Tailwind is injected via the Sandpack
 * `externalResources` option (NOT an index.html <script>, which the classic
 * bundler does not execute). We do NOT override the template's index.html.
 */
export const SANDPACK_TEMPLATE = 'react-ts' as const
export const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

/**
 * Dark Sandpack theme matching the platform (zinc + Geist). Safe to use now that
 * the loading overlay hides correctly (the stuck black overlay was a StrictMode
 * bug, not the theme). The generated app renders its own (usually light) UI in
 * the preview; this theme only styles the code editor + Sandpack chrome.
 */
export const sandpackTheme: SandpackTheme = {
  colors: {
    surface1: '#09090b',
    surface2: '#18181b',
    surface3: '#27272a',
    clickable: '#a1a1aa',
    base: '#e4e4e7',
    disabled: '#52525b',
    hover: '#fafafa',
    accent: '#c084fc',
    error: '#f87171',
    errorSurface: '#27272a',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#52525b', fontStyle: 'italic' },
    keyword: '#c084fc',
    tag: '#7dd3fc',
    punctuation: '#a1a1aa',
    definition: '#fafafa',
    property: '#7dd3fc',
    static: '#fca5a5',
    string: '#86efac',
  },
  font: {
    body: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", ui-monospace, monospace',
    size: '13px',
    lineHeight: '20px',
  },
}

const STARTER_APP = `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-400">
      <p className="text-sm">Your app will appear here. Describe it in the chat.</p>
    </div>
  )
}
`

// Cosmetic project files so the generated app reads like a real create-vite
// project (and is ejectable). The Sandpack classic bundler runs from /App.tsx;
// these don't change how it runs, only how the project looks in the Code tab.
const PACKAGE_JSON = `{
  "name": "stellar-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~6.0.0",
    "vite": "^8.0.0"
  }
}
`

const README = `# Stellar App

Built with Stellarable — React + TypeScript + TailwindCSS, ready to talk to
Stellar smart contracts.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`

// The HTML host page. Tailwind is loaded via its CDN here (and also injected
// into the preview by Sandpack). Keep the #root mount point.
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stellar App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

/** Files present in every project regardless of content. */
const BASE_FILES: FileTree = {
  '/package.json': PACKAGE_JSON,
  '/README.md': README,
  '/public/index.html': INDEX_HTML,
}

/** Merge the base project files under a set of app files. */
export function withBaseFiles(files: FileTree): FileTree {
  return { ...BASE_FILES, ...files }
}

/** The blank canvas every new project starts from. */
export function initialFileTree(): FileTree {
  return withBaseFiles({ '/App.tsx': STARTER_APP })
}

/** Apply the LLM's file operations to the tree (PLAN.md §5.4). Pure. */
export function applyFileOps(tree: FileTree, ops: FileOp[]): FileTree {
  const next = { ...tree }
  for (const op of ops) {
    if (op.op === 'create' || op.op === 'edit') next[op.path] = op.content
    else if (op.op === 'delete') delete next[op.path]
  }
  return next
}

// --- Example starters. A `files` example is a pre-built, working dApp (no LLM)
// wired to a SHARED pre-deployed testnet contract: it reads live on-chain state
// and connects Freighter. A `prompt` example drives the LLM from the blank
// template. ---

/** Browser polyfills so @stellar/stellar-sdk runs in the sandbox. Imported
 *  FIRST (before the SDK) so Buffer exists when the SDK module evaluates. */
const POLYFILLS = `import { Buffer } from 'buffer'
const g = globalThis as unknown as { Buffer?: unknown }
if (!g.Buffer) g.Buffer = Buffer
`

/** Shared, pre-deployed Demo fungible token on testnet (1,000,000 supply). */
const DEMO_TOKEN_ID = 'CCIIOMBLKX43M3D7NSSVZLJHOWXDA2F5WGVK6PDFB6V6BMOIN2NY6JWU'
const DEMO_TOKEN_VIEW_SOURCE =
  'GBPEKQEYLWDZFY5KVIPZUPXRJPXLMX6CYSPRI6Z4WCDTOQQNELXZC7RO'

const STELLAR_PACKAGE_JSON = `{
  "name": "stellar-dapp",
  "private": true,
  "version": "0.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "buffer": "^6.0.3",
    "@stellar/stellar-sdk": "^13.1.0",
    "@stellar/freighter-api": "^4.1.0"
  }
}
`

/** A tiny reusable Soroban client: read-only view calls + Freighter writes. */
const STELLAR_LIB = `import {
  rpc,
  Contract,
  TransactionBuilder,
  Networks,
  BASE_FEE,
  Address,
  nativeToScVal,
  scValToNative,
} from '@stellar/stellar-sdk'
import freighterApi from '@stellar/freighter-api'

export const RPC_URL = 'https://soroban-testnet.stellar.org'
export const NETWORK_PASSPHRASE = Networks.TESTNET
const server = new rpc.Server(RPC_URL)

/** Read a view method (no wallet). Uses a funded account just as a sim source. */
export async function readContract(
  contractId: string,
  method: string,
  viewSource: string,
  args: any[] = [],
) {
  const c = new Contract(contractId)
  const source = await server.getAccount(viewSource)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(30)
    .build()
  const sim = await server.simulateTransaction(tx)
  if (rpc.Api.isSimulationError(sim)) throw new Error(sim.error)
  return scValToNative(sim.result!.retval)
}

export const addr = (a: string) => new Address(a).toScVal()
export const i128 = (n: bigint | number) => nativeToScVal(BigInt(n), { type: 'i128' })

// Browser extensions inject only into the top frame, never the cross-origin
// Sandpack preview iframe. So in the preview we delegate wallet ops to the host
// window (which DOES have Freighter) over postMessage; standalone/exported apps
// (top-level) talk to Freighter directly.
const inIframe = typeof window !== 'undefined' && window.parent !== window.self

function bridge(method: string, extra: Record<string, unknown> = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const id = Math.random().toString(36).slice(2)
    const onMsg = (e: MessageEvent) => {
      const m = e.data
      if (!m || m.source !== 'stellarable-host' || m.id !== id) return
      window.removeEventListener('message', onMsg)
      if (m.error) reject(new Error(m.error))
      else resolve(m.result)
    }
    window.addEventListener('message', onMsg)
    window.parent.postMessage({ source: 'stellarable-dapp', id, method, ...extra }, '*')
    setTimeout(() => {
      window.removeEventListener('message', onMsg)
      reject(new Error('Wallet request timed out'))
    }, 120000)
  })
}

/** Connect Freighter and return the user's address. */
export async function connectWallet(): Promise<string> {
  if (inIframe) return bridge('getAddress')
  const c = await freighterApi.isConnected()
  if (!c.isConnected) throw new Error('Freighter is not installed. Get it at freighter.app')
  const access = await freighterApi.requestAccess()
  if (access.error) throw new Error(String(access.error))
  return access.address
}

export async function getConnectedAddress(): Promise<string | null> {
  if (inIframe) return null // require an explicit Connect click inside the preview
  const c = await freighterApi.isConnected()
  if (!c.isConnected) return null
  const a = await freighterApi.getAddress()
  return a.address || null
}

async function signXDR(xdr: string, address: string): Promise<string> {
  if (inIframe) return bridge('signXDR', { xdr, address, networkPassphrase: NETWORK_PASSPHRASE })
  const s = await freighterApi.signTransaction(xdr, {
    networkPassphrase: NETWORK_PASSPHRASE,
    address,
  })
  if (s.error) throw new Error(String(s.error))
  return s.signedTxXdr
}

/** Build, sign (Freighter, via host bridge in the preview) and submit a write. */
export async function invokeContract(
  contractId: string,
  method: string,
  caller: string,
  args: any[] = [],
): Promise<string> {
  const c = new Contract(contractId)
  const source = await server.getAccount(caller)
  const tx = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(c.call(method, ...args))
    .setTimeout(60)
    .build()
  const prepared = await server.prepareTransaction(tx)
  const signedXdr = await signXDR(prepared.toXDR(), caller)
  const txObj = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
  const sent = await server.sendTransaction(txObj as any)
  if (sent.status === 'ERROR') throw new Error(JSON.stringify(sent.errorResult))
  let got = await server.getTransaction(sent.hash)
  for (let i = 0; got.status === 'NOT_FOUND' && i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    got = await server.getTransaction(sent.hash)
  }
  if (got.status !== 'SUCCESS') throw new Error('Transaction ' + got.status)
  return sent.hash
}
`

const DEMO_TOKEN_APP = `import './polyfills'
import { useEffect, useState } from 'react'
import {
  readContract,
  connectWallet,
  getConnectedAddress,
  invokeContract,
  addr,
  i128,
} from './stellar'

const TOKEN_ID = '${DEMO_TOKEN_ID}'
const VIEW_SOURCE = '${DEMO_TOKEN_VIEW_SOURCE}'
const short = (a: string) => a.slice(0, 6) + '…' + a.slice(-4)

export default function App() {
  const [meta, setMeta] = useState<{ name: string; symbol: string; supply: string } | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('100')
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')

  const loadMeta = async () => {
    try {
      const [name, symbol, supply] = await Promise.all([
        readContract(TOKEN_ID, 'name', VIEW_SOURCE),
        readContract(TOKEN_ID, 'symbol', VIEW_SOURCE),
        readContract(TOKEN_ID, 'total_supply', VIEW_SOURCE),
      ])
      setMeta({ name, symbol, supply: String(supply) })
    } catch (e: any) { setErr(e.message) }
  }

  const loadBalance = async (a: string) => {
    try {
      const b = await readContract(TOKEN_ID, 'balance', VIEW_SOURCE, [addr(a)])
      setBalance(String(b))
    } catch (e: any) { setErr(e.message) }
  }

  useEffect(() => {
    loadMeta()
    getConnectedAddress().then((a) => { if (a) { setAddress(a); loadBalance(a) } })
  }, [])

  const connect = async () => {
    setErr('')
    try {
      const a = await connectWallet()
      setAddress(a)
      loadBalance(a)
    } catch (e: any) { setErr(e.message) }
  }

  const transfer = async () => {
    if (!address) return
    setStatus('Signing…'); setErr('')
    try {
      const hash = await invokeContract(TOKEN_ID, 'transfer', address, [
        addr(address), addr(to), i128(amount),
      ])
      setStatus('Sent: ' + hash.slice(0, 8) + '…')
      loadBalance(address)
    } catch (e: any) { setStatus(''); setErr(e.message) }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Token Dashboard</h1>
          {address ? (
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
              {short(address)}
            </span>
          ) : (
            <button onClick={connect} className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-slate-200">
              Connect Freighter
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          {meta ? (
            <>
              <p className="text-2xl font-bold">{meta.name} <span className="text-slate-500">{meta.symbol}</span></p>
              <p className="mt-1 text-sm text-slate-400">Total supply</p>
              <p className="text-lg font-semibold">{Number(meta.supply).toLocaleString()}</p>
            </>
          ) : <p className="text-sm text-slate-400">Reading contract…</p>}
          {address && (
            <div className="mt-4 border-t border-slate-800 pt-4">
              <p className="text-sm text-slate-400">Your balance</p>
              <p className="text-lg font-semibold">{balance === null ? '…' : Number(balance).toLocaleString()} {meta?.symbol}</p>
            </div>
          )}
        </div>

        {address && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="mb-3 text-sm font-medium">Transfer tokens</p>
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient G…"
              className="mb-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-500" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" inputMode="numeric"
              className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-slate-500" />
            <button onClick={transfer} disabled={!to}
              className="w-full rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50">
              Sign & transfer
            </button>
            {status && <p className="mt-2 text-xs text-emerald-400">{status}</p>}
          </div>
        )}

        {err && <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">{err}</p>}
        <p className="text-center text-xs text-slate-600">Live on Stellar testnet · contract {short(TOKEN_ID)}</p>
      </div>
    </div>
  )
}
`

export interface ExampleApp {
  label: string
  /** Pre-built dApp files (no LLM) — a working demo on a shared contract. */
  files?: FileTree
  /** Or a starter prompt the LLM builds from the blank template. */
  prompt?: string
}

export const EXAMPLE_APPS: ExampleApp[] = [
  {
    label: 'Fungible token dashboard',
    files: withBaseFiles({
      '/package.json': STELLAR_PACKAGE_JSON,
      '/polyfills.ts': POLYFILLS,
      '/stellar.ts': STELLAR_LIB,
      '/App.tsx': DEMO_TOKEN_APP,
    }),
  },
  {
    label: 'NFT minting app',
    prompt:
      'Build an NFT minting app. Deploy an NFT collection named "Demo NFTs" with symbol DNFT, then add a button to mint a token to a chosen address and a list showing the owner of each minted token id.',
  },
]
