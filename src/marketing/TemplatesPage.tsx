import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/store'
import { Nav, Footer, Eyebrow, YELLOW } from './shared'
import { fetchTemplates, type TemplateSummary } from '../lib/backend'
import { useMarketingSeo } from './seo'
import './marketing.css'

/* Use-case copy per template kind (what the template does). */
const USECASE: Record<string, { tagline: string; body: string; icon: ReactNode }> = {
  token: {
    tagline: 'A token dashboard',
    body: 'Mint, send and track a SEP-41 fungible token — name, symbol and supply. Wired to a live testnet contract with balances and transfers.',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={YELLOW} strokeWidth="1.6"><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /></svg>,
  },
  nft: {
    tagline: 'An NFT collection',
    body: 'Mint unique collectibles and show them in a gallery. Deploy your own OpenZeppelin NFT contract and mint straight to testnet.',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fafafa" strokeWidth="1.6"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L9 20" /></svg>,
  },
  swap: {
    tagline: 'A token swap',
    body: 'Swap XLM ↔ USDC through the Soroswap AMM with live quotes and slippage handling — a working DEX UI on testnet.',
    icon: <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9ec5ff" strokeWidth="1.6"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>,
  },
}

export function TemplatesPage() {
  useMarketingSeo({
    title: 'Templates — XLM Code',
    description: 'Start from a working Stellar template: a fungible token dashboard, an NFT collection minter, or a Soroswap token swap. Preview the code and clone it in one click.',
    path: '/templates',
  })
  const navigate = useNavigate()
  const { user } = useAuth()
  const [templates, setTemplates] = useState<TemplateSummary[]>([])

  useEffect(() => {
    fetchTemplates().then(setTemplates).catch(() => {})
  }, [])

  const open = (t: TemplateSummary) => {
    if (t.token) navigate(`/p/${t.token}`)
  }

  return (
    <div className="xlm-marketing" style={{ height: '100%', overflowY: 'auto' }}>
      <Nav active="templates" signedIn={!!user} onSignIn={() => (user ? navigate('/app') : navigate('/'))} />
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '90px 32px 60px' }}>
        <div className="xlm-fadeup" style={{ marginBottom: 44 }}>
          <Eyebrow>TEMPLATES</Eyebrow>
          <h1 className="xlm-h1" style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.035em', margin: '0 0 18px', lineHeight: 1.02 }}>
            Start from a working app
          </h1>
          <p style={{ fontSize: 19, color: '#9a9a9a', maxWidth: 700, margin: 0, lineHeight: 1.55 }}>
            Each template is a complete, deployed example. Preview the code, contracts and live app — then clone it to make it your own.
          </p>
        </div>

        <div className="xlm-grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
          {templates.map((t) => {
            const u = USECASE[t.kind ?? ''] ?? USECASE.token
            return (
              <div
                key={t.id}
                onClick={() => open(t)}
                className="xlm-cardext"
                style={{ border: '1px solid #1f1f1f', borderRadius: 22, padding: 30, cursor: 'pointer', background: '#070707', display: 'flex', flexDirection: 'column', minHeight: 260 }}
              >
                <div style={{ width: 52, height: 52, borderRadius: 13, border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22 }}>{u.icon}</div>
                <div style={{ fontSize: 12, letterSpacing: '0.12em', color: '#6e6e6e', textTransform: 'uppercase', marginBottom: 8 }}>{u.tagline}</div>
                <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 10 }}>{t.name}</div>
                <p style={{ fontSize: 14.5, color: '#8a8a8a', lineHeight: 1.55, margin: '0 0 22px' }}>{u.body}</p>
                <div style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: YELLOW }}>
                  Preview &amp; clone
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </div>
              </div>
            )
          })}
          {templates.length === 0 && (
            <p style={{ color: '#6e6e6e', fontSize: 14 }}>Loading templates…</p>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
