import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { MarketingLanding } from './marketing/MarketingLanding'
import { ContractsPage } from './marketing/ContractsPage'
import { PricingPage } from './marketing/PricingPage'
import { BuildHome } from './pages/BuildHome'
import { Editor } from './pages/Editor'
import { Profile } from './pages/Profile'

/** Public marketing pages at "/", "/contracts", "/pricing"; the authed app
 *  lives under the shell. */
function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingLanding />} />
      <Route path="/contracts" element={<ContractsPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route element={<AppShell />}>
        <Route path="/app" element={<BuildHome />} />
        <Route path="/projects/:slug" element={<Editor />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  )
}

export default App
