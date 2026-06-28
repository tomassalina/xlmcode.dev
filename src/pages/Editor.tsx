import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ChatPanel } from '../components/ChatPanel'
import { WorkspacePanel } from '../components/WorkspacePanel'
import { useProjects } from '../projects/store'

/** Route "/projects/:slug" — resizable chat | workspace (v0-style). */
export function Editor() {
  const { slug } = useParams<{ slug: string }>()
  const {
    getProject,
    send,
    openVersion,
    restoreVersion,
    renameProject,
    syncFiles,
    discardEdits,
    markSaved,
    createEntry,
    deleteEntry,
    addDeployedContract,
  } = useProjects()
  const project = slug ? getProject(slug) : undefined
  // While dragging the divider, kill pointer events on the preview so the
  // Sandpack iframe doesn't swallow the mouse and freeze the resize.
  const [resizing, setResizing] = useState(false)

  // No persistence yet (Milestone 5): a direct hit / refresh has no project.
  if (!project) return <Navigate to="/" replace />

  return (
    <PanelGroup direction="horizontal" className="relative min-h-0 flex-1">
      {/* While dragging, this overlay sits above the Sandpack iframe so it can't
          swallow the mouse and freeze the resize. */}
      {resizing && (
        <div className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
      <Panel defaultSize={34} minSize={22} maxSize={50}>
        <ChatPanel
          projectName={project.name}
          onRename={(name) => renameProject(project.slug, name)}
          messages={project.messages}
          busy={project.busy}
          error={project.error}
          activity={project.activity}
          streamingMessage={project.streamingMessage}
          filePaths={Object.keys(project.fileTree)}
          onSend={(text) => send(project.slug, text)}
        />
      </Panel>
      <PanelResizeHandle
        onDragging={setResizing}
        className="w-1 bg-zinc-800 transition-colors hover:bg-violet-500/60 data-[resize-handle-state=drag]:bg-violet-500"
      />
      <Panel defaultSize={66} minSize={30}>
        <div className={`h-full ${resizing ? 'pointer-events-none' : ''}`}>
          <WorkspacePanel
            fileTree={project.fileTree}
            projectName={project.slug}
            versions={project.versions}
            onOpenVersion={(id) => openVersion(project.slug, id)}
            onRestore={(id) => restoreVersion(project.slug, id)}
            generation={project.generation}
            dirty={project.dirty}
            onSyncFiles={(files) => syncFiles(project.slug, files)}
            onDiscard={() => discardEdits(project.slug)}
            onSave={() => markSaved(project.slug)}
            onCreateFile={(path) => createEntry(project.slug, path)}
            onCreateFolder={(folder) =>
              createEntry(project.slug, `${folder}/.keep`)
            }
            onDeleteEntry={(path) => deleteEntry(project.slug, path)}
            contracts={project.contracts}
            onDeployed={(c) => addDeployedContract(project.slug, c)}
            onFixError={(err) =>
              send(
                project.slug,
                `The app has an error. Please fix it:\n\n${err}`,
              )
            }
          />
        </div>
      </Panel>
    </PanelGroup>
  )
}
