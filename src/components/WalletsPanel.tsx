import { useState } from 'react'
import {
  AlertTriangle,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Wallet,
  Zap,
} from 'lucide-react'
import { useWallet, MAX_PROJECT_WALLETS } from '../wallet/store'

function CopyChip({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
      title="Copy"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

interface WalletsPanelProps {
  slug: string
}

export function WalletsPanel({ slug }: WalletsPanelProps) {
  const {
    wallet,
    mnemonic,
    balance,
    provisioning,
    error,
    ensureWallet,
    fund,
    projectWallets,
    addProjectWallet,
    fundProjectWallet,
  } = useWallet()

  const [mainFunding, setMainFunding] = useState(false)
  const [mainSecretVisible, setMainSecretVisible] = useState(false)
  const [seedVisible, setSeedVisible] = useState(false)
  const [addingWallet, setAddingWallet] = useState(false)
  const [projectSecretVisible, setProjectSecretVisible] = useState<Record<number, boolean>>({})
  const [projectFunding, setProjectFunding] = useState<Record<number, boolean>>({})

  const handleMainFund = async () => {
    setMainFunding(true)
    try {
      await fund()
    } finally {
      setMainFunding(false)
    }
  }

  const handleAddWallet = async () => {
    setAddingWallet(true)
    try {
      await addProjectWallet(slug)
    } finally {
      setAddingWallet(false)
    }
  }

  const handleFundProject = async (index: number) => {
    setProjectFunding((prev) => ({ ...prev, [index]: true }))
    try {
      await fundProjectWallet(slug, index)
    } finally {
      setProjectFunding((prev) => ({ ...prev, [index]: false }))
    }
  }

  if (provisioning) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        <p className="text-[13px]">Provisioning your testnet wallet…</p>
      </div>
    )
  }

  if (error && !wallet) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 p-6">
        <div className="flex w-full max-w-sm flex-col gap-3 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-4">
          <div className="flex items-start gap-2 text-[12.5px] text-red-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
          <button
            onClick={() => void ensureWallet().catch(() => {})}
            className="self-start rounded-lg bg-zinc-50 px-3 py-1.5 text-[12.5px] font-medium text-black transition-colors hover:bg-white"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!wallet) return null

  const expertUrl = (pk: string) =>
    `https://stellar.expert/explorer/testnet/account/${pk}`

  const pwList = projectWallets(slug)
  const seedWords = mnemonic ? mnemonic.split(' ') : []

  return (
    <div className="absolute inset-0 overflow-y-auto bg-zinc-950 text-zinc-200">
      <div className="mx-auto max-w-2xl p-6 space-y-4">

        {/* Section 1: Your account */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900">
              <Wallet className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-medium text-zinc-100">Your account</h2>
                <span className="rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                  Testnet
                </span>
              </div>
              <p className="text-[12px] text-zinc-500">Main account · index 0</p>
            </div>
          </div>

          {/* Address row */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[12.5px] text-zinc-500">Public key</span>
              <div className="flex items-center gap-1">
                <CopyChip text={wallet.publicKey} />
                <a
                  href={expertUrl(wallet.publicKey)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                  title="View on Stellar Expert"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
            <code className="block break-all font-mono text-[12.5px] text-zinc-300">
              {wallet.publicKey}
            </code>
          </div>

          {/* Balance row */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 mb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] text-zinc-500">Balance</p>
                <p className="mt-0.5 font-mono text-[20px] font-medium text-zinc-100">
                  {balance !== null ? `${balance} XLM` : '—'}
                </p>
              </div>
              <button
                onClick={() => void handleMainFund()}
                disabled={mainFunding}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {mainFunding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                {mainFunding ? 'Funding…' : 'Fund'}
              </button>
            </div>
          </div>

          {/* Secret reveal */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[12.5px] text-zinc-500">Secret key</span>
              <div className="flex items-center gap-1">
                {mainSecretVisible && <CopyChip text={wallet.secret} />}
                <button
                  onClick={() => setMainSecretVisible((v) => !v)}
                  className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                  title={mainSecretVisible ? 'Hide secret key' : 'Reveal secret key'}
                >
                  {mainSecretVisible ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            {mainSecretVisible ? (
              <code className="mt-1 block break-all font-mono text-[12.5px] text-amber-300">
                {wallet.secret}
              </code>
            ) : (
              <p className="mt-1 font-mono text-[12.5px] tracking-widest text-zinc-600">
                ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
              </p>
            )}
            <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-600">
              This key controls the account — keep it safe. Testnet only.
            </p>
          </div>
        </div>

        {/* Section 2: Seed phrase */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-medium text-zinc-300">Seed phrase</span>
            <button
              onClick={() => setSeedVisible((v) => !v)}
              className="flex items-center gap-1.5 rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
              title={seedVisible ? 'Hide seed phrase' : 'Reveal seed phrase'}
            >
              {seedVisible ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {seedVisible ? (
            <>
              <p className="mb-3 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-[12px] leading-relaxed text-amber-400">
                Back up this phrase. It restores ALL your wallets on any device. Never share it.
              </p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {seedWords.map((word, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                  >
                    <span className="w-4 text-right text-[11px] text-zinc-600">{i + 1}</span>
                    <span className="font-mono text-[12.5px] text-zinc-200">{word}</span>
                  </div>
                ))}
              </div>
              {mnemonic && (
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-zinc-500">Copy full phrase</span>
                  <CopyChip text={mnemonic} />
                </div>
              )}
            </>
          ) : (
            <p className="font-mono text-[12.5px] tracking-widest text-zinc-600">
              •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••
            </p>
          )}
        </div>

        {/* Section 3: Project wallets */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-medium text-zinc-300">
              Project wallets · {pwList.length}/{MAX_PROJECT_WALLETS}
            </span>
            {pwList.length >= MAX_PROJECT_WALLETS ? (
              <span className="text-[12px] text-zinc-500">5/5 — max reached</span>
            ) : (
              <button
                onClick={() => void handleAddWallet()}
                disabled={addingWallet}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingWallet ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {addingWallet ? 'Adding…' : 'Add wallet'}
              </button>
            )}
          </div>

          {pwList.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-[12.5px] text-zinc-500">
                No test wallets yet. Add up to 5 for multi-account testing (e.g. game players).
              </p>
              <button
                onClick={() => void handleAddWallet()}
                disabled={addingWallet}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addingWallet ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Zap className="h-3.5 w-3.5" />
                )}
                {addingWallet ? 'Adding…' : 'Add wallet'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {pwList.map((pw) => (
                <div
                  key={pw.index}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3"
                >
                  <p className="mb-2 text-[12.5px] font-medium text-zinc-300">{pw.label}</p>

                  {/* Address */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[12px] text-zinc-500">Public key</span>
                      <div className="flex items-center gap-1">
                        <CopyChip text={pw.publicKey} />
                        <a
                          href={expertUrl(pw.publicKey)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                          title="View on Stellar Expert"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    <code className="block break-all font-mono text-[12px] text-zinc-400">
                      {pw.publicKey}
                    </code>
                  </div>

                  {/* Balance + Fund */}
                  <div className="mb-2 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-zinc-500">Balance</p>
                      <p className="font-mono text-[14px] font-medium text-zinc-200">
                        {pw.balance !== undefined ? `${pw.balance} XLM` : '—'}
                      </p>
                    </div>
                    <button
                      onClick={() => void handleFundProject(pw.index)}
                      disabled={projectFunding[pw.index] ?? false}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[12.5px] font-medium text-zinc-200 transition-colors hover:border-zinc-600 hover:text-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {projectFunding[pw.index] ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Zap className="h-3.5 w-3.5" />
                      )}
                      {projectFunding[pw.index] ? 'Funding…' : 'Fund'}
                    </button>
                  </div>

                  {/* Secret */}
                  <div>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[12px] text-zinc-500">Secret key</span>
                      <div className="flex items-center gap-1">
                        {projectSecretVisible[pw.index] && <CopyChip text={pw.secret} />}
                        <button
                          onClick={() =>
                            setProjectSecretVisible((prev) => ({
                              ...prev,
                              [pw.index]: !prev[pw.index],
                            }))
                          }
                          className="rounded p-1 text-zinc-500 transition-colors hover:text-zinc-200"
                          title={
                            projectSecretVisible[pw.index] ? 'Hide secret key' : 'Reveal secret key'
                          }
                        >
                          {projectSecretVisible[pw.index] ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    {projectSecretVisible[pw.index] ? (
                      <code className="block break-all font-mono text-[12px] text-amber-300">
                        {pw.secret}
                      </code>
                    ) : (
                      <p className="font-mono text-[12px] tracking-widest text-zinc-600">
                        ••••••••••••••••••••••••••••••••••••••••••••••••••
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
