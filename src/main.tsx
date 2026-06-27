import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { ProjectsProvider } from './projects/store.tsx'

// NOTE: No <StrictMode>. Its dev-only double-mount makes Sandpack's preview
// miss the bundler "done" signal, leaving the loading overlay stuck on screen.
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <ProjectsProvider>
      <App />
    </ProjectsProvider>
  </BrowserRouter>,
)
