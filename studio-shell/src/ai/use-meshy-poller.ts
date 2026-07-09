import { useEffect, useRef } from 'react'
import { useBackgroundTaskStore } from '../store/backgroundTaskStore'
import { useEditorStore } from '../store/editorStore'
import { useDockingStore } from '../store/dockingStore'
import type { GameObject } from '../types'

const POLL_INTERVAL = 3000

/**
 * Watches for background tasks with meshJobId and polls Tripo3D for status.
 * On success, downloads the GLB and creates a GameObject in the viewport.
 */
export function useMeshyPoller() {
  const tasks = useBackgroundTaskStore((s) => s.tasks)
  const pollingRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const meshTasks = tasks.filter(
      (t) => t.meshJobId && t.status === 'running' && !pollingRef.current.has(t.id)
    )

    for (const task of meshTasks) {
      pollingRef.current.add(task.id)
      pollTask(task.id, task.meshJobId!)
    }
  }, [tasks])

  async function pollTask(taskId: string, jobId: string) {
    const poll = async () => {
      try {
        const res = await fetch(`/api/meshy/status/${jobId}`)
        if (!res.ok) {
          throw new Error(`Status check failed: ${res.status}`)
        }

        const data = await res.json()

        const store = useBackgroundTaskStore.getState()
        const currentTask = store.tasks.find((t) => t.id === taskId)
        if (!currentTask || currentTask.status !== 'running') {
          pollingRef.current.delete(taskId)
          return
        }

        if (data.progress !== undefined) {
          store.updateTaskProgress(taskId, data.progress)
        }

        if (data.status === 'SUCCEEDED') {
          pollingRef.current.delete(taskId)
          await downloadAndCreateObject(taskId, jobId)
          return
        }

        if (data.status === 'FAILED') {
          pollingRef.current.delete(taskId)
          store.failTask(taskId, data.error || 'Generation failed')
          return
        }

        setTimeout(poll, POLL_INTERVAL)
      } catch (err) {
        console.error('[MeshPoller] error:', err)
        pollingRef.current.delete(taskId)
        useBackgroundTaskStore.getState().failTask(
          taskId,
          err instanceof Error ? err.message : 'Polling failed'
        )
      }
    }

    setTimeout(poll, POLL_INTERVAL)
  }

  async function downloadAndCreateObject(taskId: string, jobId: string) {
    try {
      const res = await fetch(`/api/meshy/download/${jobId}`)
      if (!res.ok) {
        throw new Error(`Download failed: ${res.status}`)
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)

      const editorStore = useEditorStore.getState()
      const workspaceId = editorStore.rootObjectIds[0]
      if (!workspaceId) {
        throw new Error('No workspace found')
      }

      const task = useBackgroundTaskStore.getState().tasks.find((t) => t.id === taskId)
      const name = task?.command?.replace(/^Generating:\s*/, '') || `Model ${jobId.slice(0, 8)}`

      const updates: Partial<GameObject> = {
        meshUrl: blobUrl,
        meshFilename: `${jobId}.glb`,
      }

      const id = editorStore.createAndConfigureObject(
        'mesh',
        name,
        workspaceId,
        updates,
      )

      useDockingStore.getState().setInspectorBodyCollapsed(false)
      setTimeout(() => {
        useEditorStore.getState().setRequestFocusSelection(true)
      }, 150)

      editorStore.log(`Tripo: Generated "${name}"`, 'info', 'Tripo')

      editorStore.addAIWorkingObject(id)
      setTimeout(() => useEditorStore.getState().removeAIWorkingObject(id), 2000)

      useBackgroundTaskStore.getState().classifyAndComplete(taskId, {
        classification: 'task',
        summary: `Generated 3D model: ${name}`,
        fullResponseText: `Generated 3D model "${name}" via Tripo3D`,
        toolCalls: [{ toolName: 'generateMesh', args: { jobId } }],
        messageIds: [],
      })
    } catch (err) {
      console.error('[MeshPoller] download error:', err)
      useBackgroundTaskStore.getState().failTask(
        taskId,
        err instanceof Error ? err.message : 'Download failed'
      )
    }
  }
}
