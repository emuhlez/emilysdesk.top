import { Router } from 'express'
import type { Request, Response } from 'express'

const router = Router()

const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi'

function getTripoKey(): string {
  const key = process.env.TRIPO_API_KEY
  if (!key) throw new Error('TRIPO_API_KEY is not set')
  return key
}

function tripoHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getTripoKey()}`,
    'Content-Type': 'application/json',
  }
}

/**
 * POST /api/meshy/create
 * Body: { type: "image-to-3d" | "text-to-3d", prompt?: string, image_data_url?: string }
 * Returns: { jobId: string }
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { type, prompt, image_data_url } = req.body

    let body: Record<string, unknown>

    if (type === 'image-to-3d' && image_data_url) {
      // For image-to-3D: first upload the image, then create task with file_token
      const imageToken = await uploadImage(image_data_url)
      body = {
        type: 'image_to_model',
        file: { type: 'jpg', file_token: imageToken },
        model_version: 'v2.5-20250123',
        texture: true,
        pbr: true,
      }
    } else {
      // text-to-3d
      body = {
        type: 'text_to_model',
        prompt: prompt || 'a 3d model',
        model_version: 'v2.5-20250123',
        texture: true,
        pbr: true,
      }
    }

    const response = await fetch(`${TRIPO_BASE}/task`, {
      method: 'POST',
      headers: tripoHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Tripo] create error:', response.status, text)
      return res.status(response.status).json({ error: text })
    }

    const data = await response.json()
    const jobId = data.data?.task_id
    if (!jobId) {
      return res.status(500).json({ error: 'No task_id in Tripo response' })
    }
    res.json({ jobId })
  } catch (err) {
    console.error('[Tripo] create error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create Tripo job' })
  }
})

/**
 * Upload a base64 data URL image to Tripo and return the file token.
 */
async function uploadImage(dataUrl: string): Promise<string> {
  // Convert data URL to buffer
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!match) throw new Error('Invalid image data URL')

  const ext = match[1] === 'jpeg' ? 'jpg' : match[1]
  const buffer = Buffer.from(match[2], 'base64')

  // Build multipart form data manually
  const boundary = `----TripoUpload${Date.now()}`
  const filename = `upload.${ext}`

  const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: image/${ext}\r\n\r\n`
  const epilogue = `\r\n--${boundary}--\r\n`

  const bodyParts = Buffer.concat([
    Buffer.from(preamble),
    buffer,
    Buffer.from(epilogue),
  ])

  const response = await fetch(`${TRIPO_BASE}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getTripoKey()}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: bodyParts,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Image upload failed: ${response.status} ${text}`)
  }

  const data = await response.json()
  const token = data.data?.image_token
  if (!token) throw new Error('No image_token in upload response')
  return token
}

/**
 * GET /api/meshy/status/:jobId
 * Returns: { status, progress, model_url?, error? }
 */
router.get('/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

    const response = await fetch(`${TRIPO_BASE}/task/${jobId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${getTripoKey()}` },
    })

    if (!response.ok) {
      const text = await response.text()
      console.error('[Tripo] status error:', response.status, text)
      return res.status(response.status).json({ error: text })
    }

    const data = await response.json()
    const task = data.data

    // Normalize Tripo status to our expected values
    let status: string = task.status
    if (status === 'success') status = 'SUCCEEDED'
    else if (status === 'failed' || status === 'cancelled' || status === 'banned') status = 'FAILED'
    else if (status === 'running' || status === 'queued') status = 'RUNNING'

    res.json({
      status,
      progress: task.progress ?? 0,
      model_url: task.output?.pbr_model || task.output?.model || null,
      error: task.error_msg,
    })
  } catch (err) {
    console.error('[Tripo] status error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to check Tripo status' })
  }
})

/**
 * GET /api/meshy/download/:jobId
 * Downloads the GLB model from the task output URL.
 */
router.get('/download/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params

    // Fetch the task to get the model URL
    const statusRes = await fetch(`${TRIPO_BASE}/task/${jobId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${getTripoKey()}` },
    })

    if (!statusRes.ok) {
      return res.status(statusRes.status).json({ error: 'Failed to fetch task status' })
    }

    const taskData = await statusRes.json()
    const glbUrl = taskData.data?.output?.pbr_model || taskData.data?.output?.model

    if (!glbUrl) {
      return res.status(404).json({ error: 'No model URL found for this task' })
    }

    // Download the GLB file
    const glbRes = await fetch(glbUrl)
    if (!glbRes.ok) {
      return res.status(glbRes.status).json({ error: 'Failed to download GLB' })
    }

    const buffer = Buffer.from(await glbRes.arrayBuffer())
    res.set('Content-Type', 'model/gltf-binary')
    res.set('Content-Disposition', `attachment; filename="${jobId}.glb"`)
    res.send(buffer)
  } catch (err) {
    console.error('[Tripo] download error:', err)
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to download GLB' })
  }
})

export { router as meshyRouter }
