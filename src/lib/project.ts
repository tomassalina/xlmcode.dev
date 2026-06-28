import type { SandpackTheme } from '@codesandbox/sandpack-react'
import type { FileOp, FileTree } from '../../shared/types'

/**
 * The user's generated app lives as an in-memory FileTree. Sandpack (classic
 * `react-ts` template) renders it. Tailwind is injected via the Sandpack
 * `externalResources` option (NOT an index.html <script>, which the classic
 * bundler does not execute). We do NOT override the template's index.html.
 */
export const SANDPACK_TEMPLATE = 'react-ts' as const
export const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

/**
 * Dark Sandpack theme matching the platform (zinc + Geist). Safe to use now that
 * the loading overlay hides correctly (the stuck black overlay was a StrictMode
 * bug, not the theme). The generated app renders its own (usually light) UI in
 * the preview; this theme only styles the code editor + Sandpack chrome.
 */
export const sandpackTheme: SandpackTheme = {
  colors: {
    surface1: '#09090b',
    surface2: '#18181b',
    surface3: '#27272a',
    clickable: '#a1a1aa',
    base: '#e4e4e7',
    disabled: '#52525b',
    hover: '#fafafa',
    accent: '#c084fc',
    error: '#f87171',
    errorSurface: '#27272a',
  },
  syntax: {
    plain: '#e4e4e7',
    comment: { color: '#52525b', fontStyle: 'italic' },
    keyword: '#c084fc',
    tag: '#7dd3fc',
    punctuation: '#a1a1aa',
    definition: '#fafafa',
    property: '#7dd3fc',
    static: '#fca5a5',
    string: '#86efac',
  },
  font: {
    body: '"Geist Variable", ui-sans-serif, system-ui, sans-serif',
    mono: '"Geist Mono Variable", ui-monospace, monospace',
    size: '13px',
    lineHeight: '20px',
  },
}

const STARTER_APP = `export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white text-slate-400">
      <p className="text-sm">Your app will appear here. Describe it in the chat.</p>
    </div>
  )
}
`

// Cosmetic project files so the generated app reads like a real create-vite
// project (and is ejectable). The Sandpack classic bundler runs from /App.tsx;
// these don't change how it runs, only how the project looks in the Code tab.
const PACKAGE_JSON = `{
  "name": "stellar-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.0.0",
    "typescript": "~6.0.0",
    "vite": "^8.0.0"
  }
}
`

const README = `# Stellar App

Built with Stellarable — React + TypeScript + TailwindCSS, ready to talk to
Stellar smart contracts.

\`\`\`bash
pnpm install
pnpm dev
\`\`\`
`

// The HTML host page. Tailwind is loaded via its CDN here (and also injected
// into the preview by Sandpack). Keep the #root mount point.
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Stellar App</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

/** Files present in every project regardless of content. */
const BASE_FILES: FileTree = {
  '/package.json': PACKAGE_JSON,
  '/README.md': README,
  '/public/index.html': INDEX_HTML,
}

/** Merge the base project files under a set of app files. */
export function withBaseFiles(files: FileTree): FileTree {
  return { ...BASE_FILES, ...files }
}

/** The blank canvas every new project starts from. */
export function initialFileTree(): FileTree {
  return withBaseFiles({ '/App.tsx': STARTER_APP })
}

/** Apply the LLM's file operations to the tree (PLAN.md §5.4). Pure. */
export function applyFileOps(tree: FileTree, ops: FileOp[]): FileTree {
  const next = { ...tree }
  for (const op of ops) {
    if (op.op === 'create' || op.op === 'edit') next[op.path] = op.content
    else if (op.op === 'delete') delete next[op.path]
  }
  return next
}

// --- Example starters: prompts that drive the LLM to build (and deploy) a real
// Stellar dApp from the blank template. Clicking one starts a new project. ---

export interface ExampleApp {
  label: string
  /** Starter prompt — the LLM builds the dApp from the blank template and
   *  proposes the contract deploys it needs. */
  prompt: string
}

export const EXAMPLE_APPS: ExampleApp[] = [
  {
    label: 'Fungible token dashboard',
    prompt:
      'Build a token dashboard. Deploy a fungible token named "Demo" with symbol DEMO and an initial supply of 1,000,000, then show its name, symbol and total supply, plus a form to transfer tokens to an address.',
  },
  {
    label: 'NFT minting app',
    prompt:
      'Build an NFT minting app. Deploy an NFT collection named "Demo NFTs" with symbol DNFT, then add a button to mint a token to a chosen address and a list showing the owner of each minted token id.',
  },
]
