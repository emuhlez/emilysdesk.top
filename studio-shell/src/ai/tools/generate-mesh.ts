import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'

export interface GenerateMeshArgs {
  prompt: string
  name?: string
  model_type?: string
  image_data_url?: string
}

/**
 * Kicks off a Meshy generation job and creates a running background task to track it.
 * The useMeshyPoller hook will pick up the task and poll for completion.
 */
export async function executeGenerateMesh(args: GenerateMeshArgs): Promise<{ jobId: string; taskId: string }> {
  const { prompt, name, model_type, image_data_url } = args

  const type = image_data_url ? 'image-to-3d' : 'text-to-3d'

  const res = await fetch('/api/meshy/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type,
      prompt,
      model_type: model_type || 'default',
      image_data_url,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meshy create failed: ${text}`)
  }

  const { jobId } = await res.json()

  const displayName = name || prompt.slice(0, 30)
  const store = useBackgroundTaskStore.getState()
  const taskId = store.addRunningTask(`Generating: ${displayName}`)

  // Attach meshy metadata so the poller can pick it up
  store.updateTaskMeta(taskId, {
    meshJobId: jobId,
    meshJobType: type,
    progress: 0,
  })

  return { jobId, taskId }
}
