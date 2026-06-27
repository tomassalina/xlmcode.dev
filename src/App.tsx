import { Routes, Route } from 'react-router-dom'
import { TopBar } from './components/TopBar'
import { Landing } from './pages/Landing'
import { Editor } from './pages/Editor'

/** Platform layout: persistent top bar + routed body. */
function App() {
  return (
    <div className="flex h-full flex-col bg-black text-zinc-50">
      <TopBar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/projects/:slug" element={<Editor />} />
      </Routes>
    </div>
  )
}

export default App
