import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/store'
import { LoginModal } from '../auth/LoginModal'
import { Nav, Footer, Eyebrow } from './shared'
import { ContractLibrary } from './ContractLibrary'
import { useMarketingSeo } from './seo'
import './marketing.css'

/** /contracts — sales page for the contract library. */
export function ContractsPage() {
  useMarketingSeo({
    title: 'Contracts — XLM Code',
    description:
      'Configure an audited OpenZeppelin contract, connect to a live Soroban protocol by its contract ID, or describe your own — and deploy to Stellar testnet, no Rust required.',
    path: '/contracts',
  })
  const navigate = useNavigate()
  const { user } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const enter = () => (user ? navigate('/app') : setShowLogin(true))

  return (
    <div className="xlm-marketing" style={{ height: '100%', overflowY: 'auto' }}>
      <Nav active="contracts" signedIn={!!user} onSignIn={enter} />
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '90px 32px 60px' }}>
        <div className="xlm-fadeup" style={{ marginBottom: 44 }}>
          <Eyebrow>CONTRACTS</Eyebrow>
          <h1 className="xlm-h1" style={{ fontSize: 56, fontWeight: 700, letterSpacing: '-0.035em', margin: '0 0 18px', lineHeight: 1.02 }}>
            Audited contracts. Zero Rust.
          </h1>
          <p style={{ fontSize: 19, color: '#9a9a9a', maxWidth: 700, margin: 0, lineHeight: 1.55 }}>
            Configure an audited OpenZeppelin contract, connect to a live protocol by its contract ID, or describe your own — and deploy to Stellar testnet.
          </p>
        </div>
        <ContractLibrary onCustom={enter} />
      </div>
      <Footer />
      {showLogin && <LoginModal onClose={() => { setShowLogin(false); navigate('/app') }} />}
    </div>
  )
}
