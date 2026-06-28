import { useState, type ReactNode } from 'react'
import { YELLOW } from './shared'

/* The tabbed contract catalog from the design (Configurable / Existing / Custom).
   Reused by the home teaser and the /contracts page. Presentational + a single
   onAction for the Custom CTA. */

function S({ children, color = '#fafafa', w = 22 }: { children: ReactNode; color?: string; w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  )
}

type Card = { name: string; blurb: string; soon?: boolean; icon: ReactNode }

const CONFIGURABLE: Card[] = [
  { name: 'Fungible Token', blurb: 'Token with name, symbol and supply. The MVP hello-world.', icon: <S color={YELLOW}><circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /></S> },
  { name: 'Non-Fungible Token (NFT)', blurb: 'Unique collectibles: galleries, art, items.', icon: <S><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.5-3.5L9 20" /></S> },
  { name: 'NFT with Royalties', blurb: 'NFTs where the creator earns on resales.', soon: true, icon: <S color="#cfcfcf"><circle cx="12" cy="12" r="10" /><path d="m9 9 6 6" /></S> },
  { name: 'Ownable', blurb: 'Simple access control: a single owner account.', icon: <S><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.5 12.5 7-7" /><path d="m16 7 2 2 3-3-2-2z" /></S> },
  { name: 'Role-Based Access Control', blurb: 'Distinct roles per privileged action.', soon: true, icon: <S color="#cfcfcf"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="m8 8 8 8" /><path d="m16 8-8 8" /></S> },
  { name: 'Vault (SEP-56)', blurb: 'Tokenized shares of an asset pool; yield products.', soon: true, icon: <S color="#cfcfcf"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></S> },
  { name: 'Pausable', blurb: 'Pause/unpause functions for emergencies.', soon: true, icon: <S color="#cfcfcf"><circle cx="12" cy="12" r="10" /><line x1="10" y1="9" x2="10" y2="15" /><line x1="14" y1="9" x2="14" y2="15" /></S> },
  { name: 'Smart Account', blurb: 'Programmable auth (signers + policies).', soon: true, icon: <S color="#cfcfcf"><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.3 2.7-6 6-6" /><circle cx="17.5" cy="16.5" r="3" /></S> },
]

const EXISTING: { name: string; blurb: string; color: string; icon: ReactNode; wide?: boolean }[] = [
  { name: 'Soroswap', blurb: 'DEX + liquidity aggregator. Best-price swaps.', color: '#cbb6f5', icon: <S color="#cbb6f5" w={18}><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></S> },
  { name: 'Blend', blurb: 'Lending / borrowing pools with backstop.', color: '#7dd6a8', icon: <S color="#7dd6a8" w={18}><path d="M12 2s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" /></S> },
  { name: 'Reflector', blurb: 'Price oracle (SEP-40). Read-only, low risk.', color: '#cfcfcf', icon: <S color="#cfcfcf" w={18}><path d="M2 12h3l2-7 4 14 3-9 2 4h6" /></S> },
  { name: 'DeFindex', blurb: 'Yield infrastructure: automated vault strategies.', color: '#9ec5ff', icon: <S color="#9ec5ff" w={18}><polygon points="12 2 22 8.5 12 15 2 8.5" /><polyline points="2 15.5 12 22 22 15.5" /></S> },
  { name: 'Trustless Work', blurb: 'Non-custodial milestone escrow in USDC.', color: '#6ea8ff', icon: <S color="#6ea8ff" w={18}><polygon points="12 2 20 7 20 17 12 22 4 17 4 7" /><path d="m9 12 2 2 4-4" /></S> },
  { name: 'USDC (Stellar Asset Contract)', blurb: 'The asset most flows touch. First-class citizen.', color: '#5b9dff', icon: <S color="#5b9dff" w={18}><circle cx="12" cy="12" r="10" /><path d="M14.5 9.5a3 3 0 0 0-5 2.5 3 3 0 0 0 5 2.5" /></S> },
  { name: 'x402', blurb: 'HTTP-request payments / micropayments / agent payments.', color: YELLOW, wide: true, icon: <S color={YELLOW} w={18}><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></S> },
]

const SOON = (
  <span style={{ fontSize: 11, color: '#8a8a8a', background: '#1a1a1a', borderRadius: 999, padding: '4px 11px' }}>Soon</span>
)

function tabStyle(activeTab: boolean) {
  return {
    padding: '9px 16px',
    borderRadius: 10,
    fontSize: 14.5,
    cursor: 'pointer',
    color: activeTab ? '#fafafa' : '#8a8a8a',
    background: activeTab ? '#171717' : 'transparent',
    transition: 'background .2s ease, color .2s ease',
  } as const
}

export function ContractLibrary({ onCustom }: { onCustom: () => void }) {
  const [tab, setTab] = useState<'cfg' | 'ext' | 'cus'>('cfg')
  return (
    <div style={{ border: '1px solid #1f1f1f', borderRadius: 24, background: '#070707', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 6, padding: '18px 20px', borderBottom: '1px solid #161616' }}>
        <div onClick={() => setTab('cfg')} style={tabStyle(tab === 'cfg')}>Configurable</div>
        <div onClick={() => setTab('ext')} style={tabStyle(tab === 'ext')}>Existing</div>
        <div onClick={() => setTab('cus')} style={tabStyle(tab === 'cus')}>Custom</div>
      </div>

      {tab === 'cfg' && (
        <div style={{ padding: 26 }}>
          <div style={{ fontSize: 14.5, color: '#8a8a8a', marginBottom: 22 }}>
            Audited OpenZeppelin contracts for Soroban. Configure, then deploy.
          </div>
          <div className="xlm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {CONFIGURABLE.map((c) => (
              <div
                key={c.name}
                className={c.soon ? undefined : 'xlm-card'}
                style={{
                  border: `1px solid ${c.soon ? '#1c1c1c' : '#232323'}`,
                  borderRadius: 16,
                  padding: 24,
                  opacity: c.soon ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                  {c.icon}
                  {c.soon && SOON}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 9, color: c.soon ? '#cfcfcf' : '#fafafa' }}>{c.name}</div>
                <div style={{ fontSize: 14.5, color: c.soon ? '#6e6e6e' : '#8a8a8a', lineHeight: 1.5 }}>{c.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'ext' && (
        <div style={{ padding: 26 }}>
          <div style={{ fontSize: 14.5, color: '#8a8a8a', marginBottom: 22 }}>
            Connect to a live, audited protocol by its contract ID — coming soon.
          </div>
          <div className="xlm-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
            {EXISTING.map((c) => (
              <div
                key={c.name}
                className="xlm-cardext"
                style={{ border: '1px solid #232323', borderRadius: 16, padding: 24, gridColumn: c.wide ? '1 / -1' : undefined }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {c.icon}
                  </div>
                  {SOON}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 9 }}>{c.name}</div>
                <div style={{ fontSize: 14.5, color: '#8a8a8a', lineHeight: 1.5 }}>{c.blurb}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'cus' && (
        <div style={{ padding: '54px 26px 64px', textAlign: 'center' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, border: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <svg width="28" height="28" viewBox="0 0 100 100">
              <line x1="24" y1="24" x2="76" y2="76" stroke="#F6F7F8" strokeWidth="13" strokeLinecap="square" />
              <line x1="76" y1="24" x2="24" y2="76" stroke={YELLOW} strokeWidth="13" strokeLinecap="square" />
            </svg>
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', marginBottom: 12 }}>Describe any contract in plain language</div>
          <div style={{ fontSize: 16, color: '#8a8a8a', maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.55 }}>
            We generate the Soroban code, compile it, and deploy it to testnet — so you can experiment with logic that no template covers.
          </div>
          <div
            onClick={onCustom}
            className="xlm-pill"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 9, background: YELLOW, color: '#0a0a0a', fontWeight: 600, fontSize: 15, padding: '13px 26px', borderRadius: 12, cursor: 'pointer' }}
          >
            Generate a custom contract
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </div>
        </div>
      )}
    </div>
  )
}
