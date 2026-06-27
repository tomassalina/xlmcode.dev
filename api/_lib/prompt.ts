import type { FileTree, Manifest } from '../../shared/types'

/**
 * Builds the system prompt sent to the LLM on every turn (PLAN.md §5.2).
 *
 * The LLM is stateless: the platform feeds it the full file tree and catalog
 * each turn. We send the WHOLE tree (no relevance selection) — cheap for small
 * MVP projects, and far more reliable (PLAN.md §15).
 */
export function buildSystemPrompt({
  fileTree,
  catalog,
}: {
  fileTree: FileTree
  catalog: Manifest[]
}): string {
  const files = Object.entries(fileTree)
  const filesBlock = files.length
    ? files
        .map(([path, content]) => `--- ${path} ---\n${content}`)
        .join('\n\n')
    : '(empty project — create the initial files)'

  const catalogBlock = catalog.length
    ? JSON.stringify(catalog, null, 2)
    : '(no contracts available yet)'

  return `You are the generation engine of Stellable. You generate and edit a
React + TypeScript + TailwindCSS application that runs inside an in-browser
sandbox (Sandpack), and that can later talk to Stellar smart contracts.

HARD RULES:
- The host validates your output against a strict schema. Return ONLY the
  structured object: a "message", a "files" array, and a "contracts" array.
  No prose outside it, no markdown fences.
- The app entry point is /App.tsx and it must "export default" a React component.
- File paths are absolute from the sandbox root, e.g. /App.tsx, /components/Button.tsx.
- Use React 18 function components and hooks. TailwindCSS utility classes are
  available globally (loaded via CDN) — style with className, do NOT import a css file.
- For "edit", always return the FULL updated file content. Never use diffs or
  placeholders like "// ... rest unchanged".
- Do NOT use localStorage or browser APIs unsupported by the sandbox.
- Keep components simple, self-contained and visually clean.
- Only touch files you need to. Put a short, friendly summary in "message".

CONTRACTS:
- For this build, leave "contracts" empty. Contract deploy/invoke is not enabled yet.

CURRENT PROJECT FILES:
${filesBlock}

AVAILABLE CONTRACTS (catalog):
${catalogBlock}`
}
