import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Check, ExternalLink, Loader2, Wallet } from 'lucide-react'
import { useAuth } from '../auth/store'
import { useProjects } from '../projects/store'
import { useWallet } from '../wallet/store'

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

/** Route "/profile" — fake user profile + the user's testnet wallet. */
export function Profile() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { projects } = useProjects()
  if (!user) return null

  return (
    <main className="flex flex-1 justify-center overflow-y-auto px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-500/15 text-lg font-semibold text-violet-300">
            {initials(user.name)}
          </div>
          <div>
            <h1 className="text-xl font-semibold">{user.name}</h1>
            <p className="text-[13.5px] text-zinc-500">{user.email}</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-2xl font-semibold">{projects.length}</p>
            <p className="text-[12.5px] text-zinc-500">Projects</p>
          </div>
          <div className="rounded-xl border border-zinc-800 p-4">
            <p className="text-2xl font-semibold">testnet</p>
            <p className="text-[12.5px] text-zinc-500">Network</p>
          </div>
        </div>

        <WalletCard />

        <button
          onClick={() => {
            logout()
            navigate('/')
          }}
          className="mt-8 rounded-lg border border-zinc-800 px-4 py-2 text-[13.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
        >
          Sign out
        </button>
      </div>
    </main>
  )
}

/** The user's managed testnet wallet — address, balance, and a Fund button. */
function WalletCard() {
  const { wallet, balance, provisioning, fund } = useWallet()
  const [copied, setCopied] = useState(false)
  const [funding, setFunding] = useState(false)

  const doFund = async () => {
    setFunding(true)
    try {
      await fund()
    } finally {
      setFunding(false)
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-zinc-800 p-4">
      <div className="flex items-center gap-2 text-[13px] font-medium text-zinc-300">
        <Wallet className="h-4 w-4 text-zinc-500" />
        Testnet wallet
      </div>

      {provisioning || !wallet ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-zinc-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Provisioning your wallet…
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center justify-between gap-3">
            <code className="min-w-0 truncate font-mono text-[13px] text-zinc-300">
              {short(wallet.publicKey)}
            </code>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => {
                  void navigator.clipboard?.writeText(wallet.publicKey)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1200)
                }}
                className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                title="Copy address"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <a
                href={`https://stellar.expert/explorer/testnet/account/${wallet.publicKey}`}
                target="_blank"
                rel="noreferrer"
                className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                title="View on Stellar Expert"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-zinc-100">
                {balance ? Number(balance).toLocaleString() : '—'}{' '}
                <span className="text-[12px] font-normal text-zinc-500">XLM</span>
              </p>
            </div>
            <button
              onClick={doFund}
              disabled={funding}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-[12.5px] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50 disabled:opacity-60"
            >
              {funding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {funding ? 'Funding…' : 'Fund +10,000 XLM'}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-600">
            Manage the secret key and per-project wallets from the Wallets tab in
            any project.
          </p>
        </>
      )}
    </div>
  )
}
