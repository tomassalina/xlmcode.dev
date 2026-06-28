import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/store'
import { LoginModal } from '../auth/LoginModal'
import { Nav, Footer, Eyebrow, YELLOW } from './shared'
import { useMarketingSeo } from './seo'
import './marketing.css'

const FAQS: { q: string; a: string }[] = [
  { q: 'Do I need to know Rust or Soroban?', a: 'No. You describe what you want in plain language and XLM Code generates, compiles and deploys the Soroban contract for you. The base contracts are audited OpenZeppelin implementations.' },
  { q: 'Where do my contracts deploy?', a: 'Everything runs on the Stellar testnet. Keys and faucet funding are handled for you, so you can deploy and experiment without spending real assets.' },
  { q: 'Can I connect to existing protocols?', a: 'Yes — you can compose with live protocols like Soroswap by contract ID, and the generated frontend wires up the calls for you.' },
  { q: 'Can I edit and export the generated app?', a: 'Every project is a real Vite + React + TypeScript app. You can edit it live, restore previous versions, and download the full project as a zip.' },
  { q: 'How does sharing work?', a: 'Share a read-only link to any project — viewers see the code, contracts and live preview. To make changes, they clone it into their own account with one click.' },
  { q: 'What does it cost?', a: 'You can start free on testnet. Paid plans add monthly credits for heavier generation and deploy usage — see the Pricing page.' },
]

export function FaqPage() {
  useMarketingSeo({
    title: 'FAQ — XLM Code',
    description: 'Frequently asked questions about building on Stellar with XLM Code — contracts, testnet deploys, sharing, editing and pricing.',
    path: '/faq',
  })
  const navigate = useNavigate()
  const { user } = useAuth()
  const [open, setOpen] = useState<number | null>(0)
  const [showLogin, setShowLogin] = useState(false)
  const enter = () => (user ? navigate('/app') : setShowLogin(true))

  return (
    <div className="xlm-marketing" style={{ height: '100%', overflowY: 'auto' }}>
      <Nav active="faq" signedIn={!!user} onSignIn={enter} />
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '90px 32px 60px' }}>
        <div className="xlm-fadeup" style={{ marginBottom: 36 }}>
          <Eyebrow>FAQ</Eyebrow>
          <h1 className="xlm-h1" style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.035em', margin: 0, lineHeight: 1.04 }}>
            Questions, answered
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FAQS.map((f, i) => (
            <div key={i} style={{ border: '1px solid #1f1f1f', borderRadius: 16, background: '#070707', overflow: 'hidden' }}>
              <div onClick={() => setOpen(open === i ? null : i)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', cursor: 'pointer', fontSize: 17, fontWeight: 600 }}>
                {f.q}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={open === i ? YELLOW : '#8a8a8a'} strokeWidth="2" style={{ transform: open === i ? 'rotate(45deg)' : 'none', transition: 'transform .2s ease' }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </div>
              {open === i && (
                <div style={{ padding: '0 24px 22px', fontSize: 15.5, color: '#9a9a9a', lineHeight: 1.6 }}>{f.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
      {showLogin && <LoginModal onClose={() => { setShowLogin(false); navigate('/app') }} />}
    </div>
  )
}
