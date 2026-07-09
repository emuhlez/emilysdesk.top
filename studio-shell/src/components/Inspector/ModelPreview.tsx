import { useRef, useEffect } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { assetUrl, THREE_SPACE_ASSETS } from '../Viewport/threeSpaceAssets'

function getAssetDisplayName(filename: string): string {
  return filename.replace(/\.glb$/i, '')
}

const DISPLAY_NAMES = new Set(THREE_SPACE_ASSETS.map(getAssetDisplayName))

function isKnownModel(name: string): boolean {
  return DISPLAY_NAMES.has(name)
}

interface ModelPreviewProps {
  modelName: string
  className?: string
  /** When provided, load from this URL instead of assetUrl (user-selected file) */
  modelUrl?: string
}

export function ModelPreview({ modelName, className, modelUrl }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const hasUrl = !!modelUrl
    const hasKnownModel = !!modelName && isKnownModel(modelName)
    if (!hasUrl && !hasKnownModel) return

    const width = 191
    const height = 148
    const container = containerRef.current
    container.innerHTML = ''
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.style.width = '100%'
    canvas.style.height = 'auto'
    canvas.style.borderRadius = 'var(--radius-sm)'
    canvas.style.background = 'var(--bg-surface200)'
    container.appendChild(canvas)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a1a)

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.set(2, 2, 2)
    camera.lookAt(0, 0, 0)

    const ambient = new THREE.AmbientLight(0xa0a0b8, 0.95)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 5, 5)
    scene.add(dirLight)

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    renderer.setSize(width, height)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const loader = new GLTFLoader()
    const url = modelUrl ?? assetUrl(`${modelName}.glb`)

    let cancelled = false

    const baseMaterial = new THREE.MeshBasicMaterial({
      color: 0x888888,
      wireframe: false,
    })

    const applyBaseMaterial = (obj: THREE.Object3D) => {
      obj.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh
          mesh.material = baseMaterial
        }
      })
    }

    loader.load(
      url,
      (gltf) => {
        if (cancelled) return
        const root = gltf.scene
        applyBaseMaterial(root)
        const box = new THREE.Box3().setFromObject(root)
        const center = box.getCenter(new THREE.Vector3())
        root.position.copy(center).negate()
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const scale = maxDim > 0 ? 2 / maxDim : 1
        root.scale.setScalar(scale)
        scene.add(root)
        renderer.render(scene, camera)
      },
      undefined,
      () => {
        if (cancelled) return
        renderer.render(scene, camera)
      }
    )

    return () => {
      cancelled = true
      baseMaterial.dispose()
      renderer.dispose()
      container.innerHTML = ''
    }
  }, [modelName, modelUrl])

  if (!modelUrl && (!modelName || !isKnownModel(modelName))) {
    return (
      <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 148, color: 'var(--content-muted)', fontSize: 12 }}>
        No preview
      </div>
    )
  }

  return <div ref={containerRef} className={className} style={{ minHeight: 148 }} />
}
