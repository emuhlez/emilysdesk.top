import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { assetUrl, THREE_SPACE_ASSETS } from '../Viewport/threeSpaceAssets'

const DISPLAY_NAMES = new Set(THREE_SPACE_ASSETS.map((f) => f.replace(/\.glb$/i, '')))

function isKnownModel(name: string): boolean {
  return DISPLAY_NAMES.has(name)
}

type DrawSource = HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | ImageBitmap

function resolveDrawSource(texture: THREE.Texture): DrawSource | ImageData | null {
  const source = (texture.image ?? (texture as unknown as { source?: { data?: unknown } }).source?.data) as
    | DrawSource
    | ImageData
    | {
        data?: ArrayLike<number>
        width?: number
        height?: number
      }
    | null

  if (!source) return null
  if (
    source instanceof HTMLImageElement ||
    source instanceof HTMLCanvasElement ||
    (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas)
  ) {
    return source
  }
  if (source instanceof ImageData) return source
  if ('data' in source && typeof source.data !== 'undefined' && typeof source.width === 'number' && typeof source.height === 'number') {
    const array = source.data instanceof Uint8Array ? source.data : new Uint8Array(source.data as ArrayLike<number>)
    return new ImageData(new Uint8ClampedArray(array), source.width, source.height)
  }
  return null
}

function drawCentered(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, source: DrawSource | ImageData) {
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('background-color') || 'var(--bg-surface200)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = true

  const draw = (img: DrawSource) => {
    const width = (img as HTMLImageElement).naturalWidth ?? img.width
    const height = (img as HTMLImageElement).naturalHeight ?? img.height
    if (!width || !height) return
    const scale = Math.max(canvas.width / width, canvas.height / height)
    const drawWidth = width * scale
    const drawHeight = height * scale
    const offsetX = (canvas.width - drawWidth) / 2
    const offsetY = (canvas.height - drawHeight) / 2
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)
  }

  if (source instanceof ImageData) {
    const tmp = document.createElement('canvas')
    tmp.width = source.width
    tmp.height = source.height
    const tmpCtx = tmp.getContext('2d')
    tmpCtx?.putImageData(source, 0, 0)
    if (tmpCtx) draw(tmp)
  } else {
    draw(source)
  }

  ctx.restore()
}

function drawLabel(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string) {
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('background-color') || 'var(--bg-surface200)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'var(--content-muted)'
  ctx.font = '12px var(--font-sans, sans-serif)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  ctx.restore()
}

async function loadFirstTexture(gltf: GLTF): Promise<{ texture: THREE.Texture; name?: string } | null> {
  const parser = gltf.parser
  const textureDefs = parser.json.textures ?? []
  for (let i = 0; i < textureDefs.length; i += 1) {
    try {
      const texture = await parser.getDependency('texture', i)
      if (!texture) continue

      let name: string | undefined
      const textureDef = textureDefs[i]
      if (typeof textureDef.source === 'number' && parser.json.images?.[textureDef.source]) {
        const imageDef = parser.json.images[textureDef.source]
        if (typeof imageDef?.uri === 'string') {
          const uri = decodeURIComponent(imageDef.uri)
          name = uri.split(/[\\/]/).pop() ?? uri
        } else if (typeof imageDef?.name === 'string' && imageDef.name.length > 0) {
          name = imageDef.name
        }
      }

      if (texture.name && texture.name.length > 0) {
        name = texture.name
      }

      return { texture, name }
    } catch {
      // continue to next texture
    }
  }
  return null
}

interface TextureInfo {
  name?: string
}

interface TexturePreviewProps {
  modelName: string
  className?: string
  /** When provided, draws this image URL instead of loading from GLB */
  textureUrl?: string
  onTextureInfo?: (info: TextureInfo | null) => void
}

export function TexturePreview({ modelName, className, textureUrl, onTextureInfo }: TexturePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onTextureInfo?.(null)

    if (textureUrl) {
      const img = new Image()
      let cancelled = false
      img.onload = () => {
        if (!cancelled) drawCentered(ctx, canvas, img)
      }
      img.onerror = () => {
        if (!cancelled) drawLabel(ctx, canvas, 'Texture load failed')
      }
      img.src = textureUrl
      return () => {
        cancelled = true
        img.src = ''
      }
    }

    if (!modelName || !isKnownModel(modelName)) {
      drawLabel(ctx, canvas, 'No texture')
      return
    }

    let cancelled = false
    const loader = new GLTFLoader()

    loader.load(
      assetUrl(`${modelName}.glb`),
      async (gltf) => {
        if (cancelled) return

        const textureResult = await loadFirstTexture(gltf)
        if (!textureResult) {
          if (!cancelled) drawLabel(ctx, canvas, 'No texture')
          onTextureInfo?.(null)
          return
        }
        const { texture, name } = textureResult

        const source = resolveDrawSource(texture)
        if (!source) {
          if (!cancelled) drawLabel(ctx, canvas, 'No texture')
          onTextureInfo?.(null)
          return
        }

        onTextureInfo?.(name ? { name } : null)

        const render = (img: DrawSource | ImageData) => {
          if (!cancelled) drawCentered(ctx, canvas, img)
        }

        if (source instanceof HTMLImageElement) {
          if (source.complete) {
            render(source)
          } else {
            const onLoad = () => render(source)
            const onError = () => drawLabel(ctx, canvas, 'Texture load failed')
            source.addEventListener('load', onLoad, { once: true })
            source.addEventListener('error', onError, { once: true })
          }
        } else {
          render(source)
        }
      },
      undefined,
      () => {
        if (!cancelled) drawLabel(ctx, canvas, 'Texture load failed')
        onTextureInfo?.(null)
      }
    )

    return () => {
      cancelled = true
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [modelName, textureUrl])

  return <canvas ref={canvasRef} width={191} height={148} className={className} />
}


