import { useState } from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FilePlus,
  FolderPlus,
  Trash2,
} from 'lucide-react'
import type { FileTree as FileTreeMap } from '../../shared/types'

interface TreeNode {
  name: string
  path: string
  dir: boolean
  children: TreeNode[]
}

const isPlaceholder = (rel: string) => /(^|\/)\.(git)?keep$/.test(rel)

function buildTree(paths: string[]): TreeNode {
  const root: TreeNode = { name: '', path: '', dir: true, children: [] }
  const insert = (parts: string[], isFile: boolean) => {
    let node = root
    parts.forEach((part, i) => {
      const dir = !(i === parts.length - 1 && isFile)
      let child = node.children.find((c) => c.name === part)
      if (!child) {
        child = { name: part, path: `${node.path}/${part}`, dir, children: [] }
        node.children.push(child)
      }
      node = child
    })
  }
  for (const full of paths) {
    const rel = full.replace(/^\/+/, '')
    if (!rel) continue
    if (isPlaceholder(rel)) {
      const folder = rel.replace(/\/?\.(git)?keep$/, '')
      if (folder) insert(folder.split('/'), false)
    } else {
      insert(rel.split('/'), true)
    }
  }
  return root
}

const sortNodes = (nodes: TreeNode[]) =>
  [...nodes].sort((a, b) =>
    a.dir !== b.dir ? (a.dir ? -1 : 1) : a.name.localeCompare(b.name),
  )

type Menu = { x: number; y: number; node: TreeNode } | null
type NameModal = { kind: 'file' | 'folder'; base: string } | null

/**
 * Custom file explorer over our file tree: open files, and right-click to
 * create files/folders or delete. Folders are path-based; "new folder" drops a
 * hidden `.keep` placeholder so an empty folder still shows. Must live inside
 * SandpackProvider (uses it to open/highlight the active file).
 */
export function FileExplorer({
  fileTree,
  onCreateFile,
  onCreateFolder,
  onDelete,
}: {
  fileTree: FileTreeMap
  onCreateFile: (path: string) => void
  onCreateFolder: (folderPath: string) => void
  onDelete: (path: string) => void
}) {
  const { sandpack } = useSandpack()
  const root = buildTree(Object.keys(fileTree))
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menu, setMenu] = useState<Menu>(null)
  const [modal, setModal] = useState<NameModal>(null)

  const toggle = (path: string) =>
    setCollapsed((s) => {
      const next = new Set(s)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })

  const openMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, node })
  }

  const renderNode = (node: TreeNode, depth: number) => {
    const pad = { paddingLeft: 8 + depth * 12 }
    if (node.dir) {
      const open = !collapsed.has(node.path)
      return (
        <div key={node.path}>
          <button
            onClick={() => toggle(node.path)}
            onContextMenu={(e) => openMenu(e, node)}
            style={pad}
            className="flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[12.5px] text-zinc-300 hover:bg-zinc-900"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            )}
            <Folder className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
            <span className="truncate">{node.name}</span>
          </button>
          {open &&
            sortNodes(node.children).map((c) => renderNode(c, depth + 1))}
        </div>
      )
    }
    const active = sandpack.activeFile === node.path
    return (
      <button
        key={node.path}
        onClick={() => sandpack.setActiveFile(node.path)}
        onContextMenu={(e) => openMenu(e, node)}
        style={pad}
        className={`flex w-full items-center gap-1.5 py-1 pr-2 text-left text-[12.5px] hover:bg-zinc-900 ${
          active ? 'bg-zinc-900 text-zinc-100' : 'text-zinc-400'
        }`}
      >
        <File className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div
      className="relative h-full w-52 shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 py-1"
      onContextMenu={(e) => openMenu(e, root)}
    >
      {sortNodes(root.children).map((c) => renderNode(c, 0))}

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div
            className="fixed z-50 w-40 rounded-lg border border-zinc-800 bg-zinc-950 p-1 shadow-xl"
            style={{ top: menu.y, left: menu.x }}
          >
            <button
              onClick={() => {
                setModal({ kind: 'file', base: menu.node.dir ? menu.node.path : '' })
                setMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-zinc-900"
            >
              <FilePlus className="h-3.5 w-3.5" /> New file
            </button>
            <button
              onClick={() => {
                setModal({ kind: 'folder', base: menu.node.dir ? menu.node.path : '' })
                setMenu(null)
              }}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-zinc-300 hover:bg-zinc-900"
            >
              <FolderPlus className="h-3.5 w-3.5" /> New folder
            </button>
            {menu.node.path && (
              <button
                onClick={() => {
                  onDelete(menu.node.path)
                  setMenu(null)
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-red-400 hover:bg-zinc-900"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </>
      )}

      {modal && (
        <NameModal
          kind={modal.kind}
          base={modal.base}
          onClose={() => setModal(null)}
          onSubmit={(name) => {
            const clean = name.replace(/^\/+|\/+$/g, '').trim()
            if (clean) {
              const full = `${modal.base}/${clean}`
              if (modal.kind === 'file') onCreateFile(full)
              else onCreateFolder(full)
            }
            setModal(null)
          }}
        />
      )}
    </div>
  )
}

function NameModal({
  kind,
  base,
  onClose,
  onSubmit,
}: {
  kind: 'file' | 'folder'
  base: string
  onClose: () => void
  onSubmit: (name: string) => void
}) {
  const [value, setValue] = useState('')
  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-medium">
          New {kind} {base && <span className="text-zinc-500">in {base}/</span>}
        </h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSubmit(value)
            if (e.key === 'Escape') onClose()
          }}
          placeholder={kind === 'file' ? 'Button.tsx' : 'components'}
          className="mt-4 w-full select-text rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-[14px] text-zinc-100 outline-none focus:border-zinc-600"
        />
        <div className="mt-5 flex justify-end gap-2 text-[13px]">
          <button
            onClick={onClose}
            className="rounded-lg px-3.5 py-1.5 text-zinc-400 hover:text-zinc-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(value)}
            disabled={!value.trim()}
            className="rounded-lg bg-zinc-50 px-3.5 py-1.5 font-medium text-black transition-colors hover:bg-white disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
