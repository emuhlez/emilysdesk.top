import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

interface ModelPreviewProps {
  modelPath: string
  className?: string
  animate?: boolean
  onLoadingChange?: (isLoading: boolean) => void
}

// Queue system to limit concurrent model loads
class ModelLoadQueue {
  private static instance: ModelLoadQueue | null = null
  private queue: Array<() => void> = []
  private activeLoads = 0
  private maxConcurrent = 2 // Only load 2 models at a time for Safari/Arc

  static getInstance(): ModelLoadQueue {
    if (!ModelLoadQueue.instance) {
      ModelLoadQueue.instance = new ModelLoadQueue()
    }
    return ModelLoadQueue.instance
  }

  enqueue(loadFn: () => void) {
    this.queue.push(loadFn)
    this.processQueue()
  }

  private processQueue() {
    while (this.activeLoads < this.maxConcurrent && this.queue.length > 0) {
      const loadFn = this.queue.shift()
      if (loadFn) {
        this.activeLoads++
        loadFn()
      }
    }
  }

  notifyComplete() {
    this.activeLoads--
    this.processQueue()
  }
}

// Shared resources to minimize WebGL context usage
class SharedRendererPool {
  private static instance: SharedRendererPool | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private refCount = 0
  private canvas: HTMLCanvasElement | null = null

  static getInstance(): SharedRendererPool {
    if (!SharedRendererPool.instance) {
      SharedRendererPool.instance = new SharedRendererPool()
    }
    return SharedRendererPool.instance
  }

  acquire(): { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera } {
    this.refCount++
    
    if (!this.renderer) {
      // Create offscreen canvas for rendering
      this.canvas = document.createElement('canvas')
      this.canvas.width = 128 // Reduced from 256 for better performance
      this.canvas.height = 128
      
      const renderer = new THREE.WebGLRenderer({ 
        canvas: this.canvas,
        antialias: false, // Disable for performance
        alpha: true,
        preserveDrawingBuffer: true, // Needed for toDataURL
        powerPreference: 'low-power', // Use low-power for thumbnails
      })
      renderer.setClearColor(0x000000, 0)
      renderer.setSize(128, 128, false)
      renderer.setPixelRatio(1) // Fixed pixel ratio for consistency
      this.renderer = renderer

      const scene = new THREE.Scene()
      this.scene = scene

      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 1000)
      camera.position.set(3, 2.5, 5)
      camera.lookAt(0, 0, 0)
      this.camera = camera

      // Simplified lighting for thumbnails
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
      scene.add(ambientLight)
    }

    return {
      renderer: this.renderer!,
      scene: this.scene!,
      camera: this.camera!,
    }
  }

  release() {
    this.refCount--
    if (this.refCount <= 0) {
      this.cleanup()
    }
  }

  cleanup() {
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer = null
    }
    this.scene = null
    this.camera = null
    this.canvas = null
    this.refCount = 0
  }
}

export function ModelPreview({ modelPath, className, animate = false, onLoadingChange }: ModelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const modelRef = useRef<THREE.Group | null>(null)
  const animationIdRef = useRef<number | null>(null)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const rotationRef = useRef(0)
  
  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading)
  }, [isLoading, onLoadingChange])

  // Intersection Observer to detect when element is visible
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsVisible(entry.isIntersecting)
        })
      },
      {
        rootMargin: '100px', // Start loading earlier
        threshold: 0.01,
      }
    )

    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
    }
  }, [])

  // Load model and generate thumbnail
  useEffect(() => {
    if (!isVisible) return

    const pool = SharedRendererPool.getInstance()
    const queue = ModelLoadQueue.getInstance()
    const { renderer, scene, camera } = pool.acquire()
    
    let cancelled = false
    
    // Queue the model load to prevent overload
    queue.enqueue(() => {
      if (cancelled) {
        queue.notifyComplete()
        return
      }
      
      const loader = new GLTFLoader()
      setIsLoading(true)
      setLoadError(false)
      
      loader.load(
        modelPath,
        (gltf) => {
          if (cancelled) {
            queue.notifyComplete()
            return
          }
          
          const model = gltf.scene
          modelRef.current = model

          // Center and scale model (cached Box3 for reuse)
          const box = new THREE.Box3().setFromObject(model)
          const size = box.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const scale = maxDim > 0 ? 1.5 / maxDim : 1
          model.scale.setScalar(scale)
          
          box.setFromObject(model)
          const scaledCenter = box.getCenter(new THREE.Vector3())
          model.position.sub(scaledCenter)

          scene.add(model)

          // Render to generate thumbnail
          try {
            renderer.render(scene, camera)
            const dataUrl = renderer.domElement.toDataURL('image/png', 0.8) // 0.8 quality for smaller size
            setThumbnail(dataUrl)
          } catch (err) {
            console.error('Error generating thumbnail:', err)
            setLoadError(true)
          }

          scene.remove(model)
          
          // Dispose of model geometry/materials to free memory
          model.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh
              mesh.geometry?.dispose()
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach(m => m.dispose())
              } else {
                mesh.material?.dispose()
              }
            }
          })
          
          setIsLoading(false)
          queue.notifyComplete()
        },
        undefined,
        (error) => {
          if (!cancelled) {
            console.error('Error loading model:', error, modelPath)
            setLoadError(true)
            setIsLoading(false)
          }
          queue.notifyComplete()
        }
      )
    })

    return () => {
      cancelled = true
      if (modelRef.current) {
        scene.remove(modelRef.current)
        modelRef.current = null
      }
      pool.release()
    }
  }, [modelPath, isVisible])

  // Handle animation for grid view
  useEffect(() => {
    if (!animate || !thumbnail || !imgRef.current) {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }
      rotationRef.current = 0
      if (imgRef.current) {
        imgRef.current.style.transform = 'rotateY(0deg)'
      }
      return
    }

    // CSS-based rotation animation (much more performant than WebGL)
    const animateRotation = () => {
      if (!imgRef.current) return
      rotationRef.current += 1
      imgRef.current.style.transform = `rotateY(${rotationRef.current}deg)`
      animationIdRef.current = requestAnimationFrame(animateRotation)
    }
    animateRotation()

    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current)
        animationIdRef.current = null
      }
    }
  }, [animate, thumbnail])

  return (
    <div ref={containerRef} className={className} style={{ width: '100%', height: '100%', position: 'relative' }}>
      {thumbnail && (
        <img
          ref={imgRef}
          src={thumbnail}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 'inherit',
            transition: animate ? 'none' : 'transform 0.3s ease',
          }}
        />
      )}
      {loadError && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255, 100, 100, 0.6)',
          fontSize: '9px',
        }}>
          ✕
        </div>
      )}
    </div>
  )
}
