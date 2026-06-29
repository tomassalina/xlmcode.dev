import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../auth/store'
import { Nav, Footer, Eyebrow } from './shared'
import { TemplatesGallery, TemplatesGallerySkeleton } from './TemplatesGallery'
import { useMarketingSeo } from './seo'
import './marketing.css'

export function TemplatesPage() {
  useMarketingSeo({
    title: 'Templates — XLM Code',
    description: 'Start from a working Stellar template: a fungible token dashboard, an NFT collection minter, or a Soroswap token swap. Preview the code and clone it in one click.',
    path: '/templates',
  })
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // Logged-in users get the in-shell templates view (only once auth resolves —
  // avoids a flash of the public page before the redirect).
  if (!loading && user) return <Navigate to="/app/templates" replace />

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
        {loading ? <TemplatesGallerySkeleton /> : <TemplatesGallery />}
      </div>
      <Footer />
    </div>
  )
}
