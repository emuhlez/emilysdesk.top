import { useRef, useEffect, useLayoutEffect, memo } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { useEditorStore } from '../../store/editorStore'
import {
  THREE_SPACE_ASSETS,
  assetUrl,
} from './threeSpaceAssets'
import styles from './Viewport.module.css'

const GRID_COLS = 6
const CELL_SPACING = 4
const MODEL_SCALE = 2
const CAMERA_FAR = 2000
const CAMERA_NEAR = 0.1
const CAMERA_FOV = 50

const ORBIT_SENSITIVITY = 0.004
const ZOOM_SENSITIVITY = 0.001
/** macOS/iOS use "natural" scroll; invert vertical orbit so drag-up = tilt view up */
const VERTICAL_ORBIT_INVERTED =
  typeof navigator !== 'undefined' &&
  (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ||
    (navigator as { userAgentData?: { platform: string } }).userAgentData?.platform === 'macOS')
const MIN_RADIUS = 8
const MAX_RADIUS = 400
const MIN_PHI = 0.05
const MAX_PHI = Math.PI - 0.05
const DRAG_THRESHOLD_PX = 4
const PAN_SPEED = 0.35
const PAN_KEYS = new Set(['w', 'a', 's', 'd', 'q', 'e', 'r', 'f'])
const INITIAL_TARGET = new THREE.Vector3(0, 0, 0)
const INITIAL_RADIUS = Math.sqrt(40 * 40 + 35 * 35 + 40 * 40)
const INITIAL_THETA = Math.atan2(40, 40)
const INITIAL_PHI = Math.acos(Math.max(-1, Math.min(1, 35 / INITIAL_RADIUS)))

function getAssetDisplayName(filename: string): string {
  return filename.replace(/\.glb$/i, '')
}

function findRootWithAssetName(obj: THREE.Object3D, modelsGroup: THREE.Group): THREE.Object3D | null {
  let current: THREE.Object3D | null = obj
  while (current) {
    if (current.userData.assetName != null) return current
    if (current.parent === modelsGroup) return current
    current = current.parent
  }
  return null
}

function setHighlight(root: THREE.Object3D, on: boolean) {
  root.traverse((node: THREE.Object3D) => {
    if ((node as THREE.Mesh).isMesh) {
      const mesh = node as THREE.Mesh
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      
      materials.forEach((mat) => {
        if (mat && (mat as THREE.MeshStandardMaterial).emissive !== undefined) {
          const m = mat as THREE.MeshStandardMaterial
          if (on) {
            // Store original emissive if not already highlighted
            if (!mesh.userData.isHighlighted) {
              mesh.userData.originalEmissive = m.emissive.getHex()
              mesh.userData.originalEmissiveIntensity = m.emissiveIntensity
              mesh.userData.isHighlighted = true
            }
            // Set blue emissive glow
            m.emissive.setHex(0x3498db)
            m.emissiveIntensity = 0.6
            m.needsUpdate = true
          } else {
            // Restore original emissive
            if (mesh.userData.isHighlighted) {
              m.emissive.setHex(mesh.userData.originalEmissive || 0x000000)
              m.emissiveIntensity = mesh.userData.originalEmissiveIntensity || 0
              m.needsUpdate = true
              // Clear stored values
              mesh.userData.isHighlighted = false
              delete mesh.userData.originalEmissive
              delete mesh.userData.originalEmissiveIntensity
            }
          }
        }
      })
    }
  })
}

export const Viewport3D = memo(function Viewport3D({ containerRef }: { containerRef: React.RefObject<HTMLDivElement | null> }) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const modelsGroupRef = useRef<THREE.Group | null>(null)
  const frameRef = useRef<number>(0)
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster())
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2())
  const resetViewRef = useRef(false)
  const focusSelectedRef = useRef(false)
  const needsRenderRef = useRef(false)
  const initializedRef = useRef(false)
  const resizeTimeoutRef = useRef<number | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const eventHandlersRef = useRef<{
    onPointerDown?: (e: PointerEvent) => void
    onPointerMove?: (e: PointerEvent) => void
    onPointerUp?: (e: PointerEvent) => void
    onPointerEnter?: () => void
    onPointerLeave?: () => void
    onWheel?: (e: WheelEvent) => void
    onKeyDown?: (e: KeyboardEvent) => void
    onKeyUp?: (e: KeyboardEvent) => void
    onResize?: () => void
    wheelOpts?: AddEventListenerOptions
  }>({})
  
  // Store function refs to keep stable references
  const setViewportSelectedAssetRef = useRef(useEditorStore.getState().setViewportSelectedAsset)
  const addWorkspaceModelRef = useRef(useEditorStore.getState().addWorkspaceModel)
  const updateGameObjectRef = useRef(useEditorStore.getState().updateGameObject)
  
  useEffect(() => {
    setViewportSelectedAssetRef.current = useEditorStore.getState().setViewportSelectedAsset
    addWorkspaceModelRef.current = useEditorStore.getState().addWorkspaceModel
    updateGameObjectRef.current = useEditorStore.getState().updateGameObject
  })

  const viewportSelectedAssetNames = useEditorStore((s) => s.viewportSelectedAssetNames)
  const gameObjects = useEditorStore((s) => s.gameObjects)
  const rootObjectIds = useEditorStore((s) => s.rootObjectIds)
  const loadedMeshUrlsRef = useRef<Record<string, string>>({})

  useLayoutEffect(() => {
    console.log('[Viewport3D] useLayoutEffect triggered')
    const container = containerRef.current
    if (!container) {
      console.warn('[Viewport3D] Container ref not ready')
      return
    }
    
    console.log('[Viewport3D] Container found', {
      width: container.clientWidth,
      height: container.clientHeight,
      display: window.getComputedStyle(container).display,
      visibility: window.getComputedStyle(container).visibility,
      initializedFlag: initializedRef.current,
      hasRenderer: !!rendererRef.current,
      hasScene: !!sceneRef.current,
      hasCamera: !!cameraRef.current
    })
    
    if (!container.clientWidth || !container.clientHeight) {
      console.warn('[Viewport3D] Container has no dimensions - scheduling retry')
      // Retry after a short delay to allow layout to complete
      const retryTimer = window.setTimeout(() => {
        if (containerRef.current && containerRef.current.clientWidth > 0) {
          console.log('[Viewport3D] Retry successful, triggering re-render')
          needsRenderRef.current = true
        }
      }, 100)
      return () => clearTimeout(retryTimer)
    }
    
    // Check if initialization was started but not completed
    if (initializedRef.current) {
      // If flag is true but refs aren't set, initialization failed - retry
      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) {
        console.warn('[Viewport3D] Initialization flag set but refs missing - retrying initialization')
        initializedRef.current = false
        // Clean up any partial refs
        rendererRef.current?.dispose()
        rendererRef.current = null
        sceneRef.current = null
        cameraRef.current = null
        modelsGroupRef.current = null
      } else {
        console.log('[Viewport3D] Already initialized and refs valid, skipping')
        return
      }
    }
    
    // Double-check refs aren't somehow set without flag
    if (rendererRef.current || sceneRef.current || cameraRef.current) {
      console.warn('[Viewport3D] Refs are set but flag is false - cleaning up stale refs')
      rendererRef.current?.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      modelsGroupRef.current = null
    }

    console.log('[Viewport3D] ✅ Starting Three.js initialization', {
      width: container.clientWidth,
      height: container.clientHeight
    })
    
    // Set flag immediately to prevent double initialization in React strict mode
    initializedRef.current = true
    
    try {
      const width = container.clientWidth
      const height = container.clientHeight

      console.log('[Viewport3D] Creating scene...')
      const scene = new THREE.Scene()
      sceneRef.current = scene
      console.log('[Viewport3D] Scene created ✓')

    // Create skybox with blue sky gradient
    const skyGeometry = new THREE.SphereGeometry(CAMERA_FAR * 0.9, 32, 32)
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1E88E5) }, // Bright sky blue
        bottomColor: { value: new THREE.Color(0xE8F4FD) }, // Very pale blue/white horizon
        offset: { value: 0.4 },
        exponent: { value: 0.8 }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float t = max(pow(max(h + offset, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `
    })
    const skyMesh = new THREE.Mesh(skyGeometry, skyMaterial)
    skyMesh.renderOrder = -1 // Render first
    scene.add(skyMesh)

    console.log('[Viewport3D] Creating camera...')
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, width / height, CAMERA_NEAR, CAMERA_FAR)
    camera.position.set(40, 35, 40)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    console.log('[Viewport3D] Camera created ✓')

    const target = new THREE.Vector3(0, 0, 0)
    let radius = camera.position.distanceTo(target)
    let theta = Math.atan2(camera.position.x - target.x, camera.position.z - target.z)
    let phi = Math.acos(Math.max(-1, Math.min(1, (camera.position.y - target.y) / radius)))

    const updateCameraFromOrbit = () => {
      camera.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta)
      camera.position.y = target.y + radius * Math.cos(phi)
      camera.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta)
      camera.lookAt(target)
    }

    console.log('[Viewport3D] Creating renderer...')
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: false,
      powerPreference: 'high-performance', // Optimize for performance on Safari/Arc
      stencil: false, // Disable stencil buffer for better performance
    })
    renderer.setSize(width, height)
    // Limit pixel ratio to 1.5 for better performance on Retina displays (Safari/Arc)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    console.log('[Viewport3D] Renderer created ✓')

    const canvas = renderer.domElement
    canvasRef.current = canvas
    canvas.className = styles.viewport3dCanvas
    canvas.style.pointerEvents = 'auto'
    canvas.setAttribute('tabindex', '0')
    canvas.setAttribute('title', 'Viewport — F: focus on selected object, R: reset view')

    const keysPressed = new Set<string>()
    let lastPanTime = performance.now()

    const wrapper = document.createElement('div')
    wrapperRef.current = wrapper
    wrapper.className = styles.canvas3DInner
    wrapper.style.pointerEvents = 'none'
    wrapper.appendChild(canvas)
    container.appendChild(wrapper)
    ;(canvas as HTMLCanvasElement).style.pointerEvents = 'auto'
    ;(canvas as HTMLCanvasElement).style.cursor = 'grab'

    const enforceCanvasLock = () => {
      canvas.style.setProperty('inset', '0', 'important')
    }
    enforceCanvasLock()

    rendererRef.current = renderer

    // Lights – brighter setup so assets are well lit
    const ambient = new THREE.AmbientLight(0xa0a0b8, 0.95)
    scene.add(ambient)
    const hemisphere = new THREE.HemisphereLight(0xffffff, 0x8888aa, 0.55)
    scene.add(hemisphere)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.4)
    dirLight.position.set(25, 45, 25)
    dirLight.castShadow = true
    // Reduced shadow map size for better performance on Safari/Arc
    dirLight.shadow.mapSize.width = 512
    dirLight.shadow.mapSize.height = 512
    dirLight.shadow.camera.near = 0.5
    dirLight.shadow.camera.far = 200
    dirLight.shadow.camera.left = -50
    dirLight.shadow.camera.right = 50
    dirLight.shadow.camera.top = 50
    dirLight.shadow.camera.bottom = -50
    scene.add(dirLight)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5)
    fillLight.position.set(-20, 15, 10)
    scene.add(fillLight)

    // Floor grid with custom texture (XZ plane at y=0)
    const gridSize = 72
    const textureLoader = new THREE.TextureLoader()
    const gridTexture = textureLoader.load(`/textures/grid-floor.png?v=${Date.now()}`)
    gridTexture.wrapS = THREE.RepeatWrapping
    gridTexture.wrapT = THREE.RepeatWrapping
    gridTexture.repeat.set(18, 18) // Repeat the pattern to fill 72x72 grid
    gridTexture.colorSpace = THREE.SRGBColorSpace
    
    const floorGeometry = new THREE.PlaneGeometry(gridSize, gridSize)
    const floorMaterial = new THREE.MeshStandardMaterial({ 
      map: gridTexture,
      roughness: 0.8,
      metalness: 0.1
    })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2 // Rotate to lie flat on XZ plane
    floor.position.y = 0
    floor.receiveShadow = true
    scene.add(floor)

    const loader = new GLTFLoader()
    const modelsGroup = new THREE.Group()
    scene.add(modelsGroup)
    modelsGroupRef.current = modelsGroup

    // Declare needsRender early so model loading can access it
    let needsRender = true

    function placeModel(index: number): { x: number; z: number } {
      const col = index % GRID_COLS
      const row = Math.floor(index / GRID_COLS)
      const x = (col - (GRID_COLS - 1) / 2) * CELL_SPACING
      const z = row * CELL_SPACING
      return { x, z }
    }

    function fitScale(obj: THREE.Object3D): number {
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim <= 0) return 1
      return MODEL_SCALE / maxDim
    }

    // Optimized model loading with better batching
    // Load models in batches with controlled concurrency
    let loadedCount = 0
    let activeLoads = 0
    const MAX_CONCURRENT_LOADS = 4 // Increased from 3 for better parallelism
    
    const loadNextModel = (index: number) => {
      if (index >= THREE_SPACE_ASSETS.length) return
      
      activeLoads++
      const filename = THREE_SPACE_ASSETS[index]
      const url = assetUrl(filename)
      
      loader.load(
        url,
        (gltf: { scene: THREE.Group }) => {
          const root = gltf.scene
          const displayName = getAssetDisplayName(filename)
          const objId = addWorkspaceModelRef.current(displayName)
          root.userData.assetName = displayName
          root.userData.objectId = objId
          root.traverse((node: THREE.Object3D) => {
            if ((node as THREE.Mesh).isMesh) {
              (node as THREE.Mesh).castShadow = true
              ;(node as THREE.Mesh).receiveShadow = true
            }
          })
          const baseScale = fitScale(root)
          root.userData.baseScale = baseScale
          const { x, z } = placeModel(index)
          updateGameObjectRef.current(objId, {
            transform: {
              position: { x, y: 0, z },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
          })
          root.position.set(x, 0, z)
          root.scale.setScalar(baseScale)
          modelsGroup.add(root)
          needsRender = true
          
          activeLoads--
          loadedCount++
          
          // Load next model if available
          if (loadedCount + activeLoads < THREE_SPACE_ASSETS.length) {
            loadNextModel(loadedCount + activeLoads)
          }
        },
        undefined,
        () => {
          activeLoads--
          // On error, try loading next model
          if (loadedCount + activeLoads < THREE_SPACE_ASSETS.length) {
            loadNextModel(loadedCount + activeLoads)
          }
        }
      )
    }
    
    // Start loading first batch concurrently
    const initialBatchSize = Math.min(MAX_CONCURRENT_LOADS, THREE_SPACE_ASSETS.length)
    for (let i = 0; i < initialBatchSize; i++) {
      loadNextModel(i)
    }

    const raycaster = raycasterRef.current
    const mouse = mouseRef.current

    let isOrbiting = false
    let dragStartX = 0
    let dragStartY = 0
    let pointerSessionStartedOnCanvas = false

    const performPick = (clientX: number, clientY: number, additive: boolean) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(modelsGroup.children, true)
      if (hits.length > 0) {
        const root = findRootWithAssetName(hits[0].object, modelsGroup)
        const name = root?.userData.assetName as string | undefined
        if (name) setViewportSelectedAssetRef.current({ name }, { additive })
      } else if (!additive) {
        setViewportSelectedAssetRef.current(null)
      }
    }

    const onPointerDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      pointerSessionStartedOnCanvas = true
      ;(canvas as HTMLCanvasElement).focus()
      dragStartX = e.clientX
      dragStartY = e.clientY
      isOrbiting = false
    }

    const onPointerMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return
      if (!pointerSessionStartedOnCanvas) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      if (!isOrbiting && (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX)) {
        isOrbiting = true
        canvas.style.cursor = 'grabbing'
      }
      if (isOrbiting) {
        theta -= dx * ORBIT_SENSITIVITY
        const orbitDy = VERTICAL_ORBIT_INVERTED ? -dy : dy
        phi = Math.max(MIN_PHI, Math.min(MAX_PHI, phi - orbitDy * ORBIT_SENSITIVITY))
        updateCameraFromOrbit()
        needsRender = true // Force render on camera movement
        dragStartX = e.clientX
        dragStartY = e.clientY
      }
    }

    const onPointerUp = (e: MouseEvent) => {
      if (e.button !== 0) return
      if (pointerSessionStartedOnCanvas && !isOrbiting) {
        performPick(e.clientX, e.clientY, e.ctrlKey || e.metaKey || e.shiftKey)
      }
      pointerSessionStartedOnCanvas = false
      isOrbiting = false
      canvas.style.cursor = 'grab'
    }

    const onPointerEnter = () => {
      canvas.style.cursor = 'grab'
    }

    const onPointerLeave = () => {
      isOrbiting = false
      canvas.style.cursor = 'default'
    }

    const onWheel = (e: Event) => {
      const ev = e as WheelEvent
      ev.preventDefault()
      const factor = 1 - ev.deltaY * ZOOM_SENSITIVITY
      radius = Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius * factor))
      updateCameraFromOrbit()
      needsRender = true // Force render on zoom
    }

    const wheelOpts = { passive: false }
    
    // Store event handlers in ref for cleanup
    eventHandlersRef.current = {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerEnter,
      onPointerLeave,
      onWheel,
      wheelOpts
    }
    
    canvas.addEventListener('wheel', onWheel, wheelOpts as object)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const viewportFocused =
        document.activeElement === canvas ||
        (container.contains(document.activeElement as Node) && document.activeElement !== document.body)
      // F: focus on selection — work from anywhere when something is selected (not when typing in an input)
      const inInput = document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable
      if (key === 'f' && !inInput) {
        const state = useEditorStore.getState()
        const hasSelection = state.viewportSelectedAssetNames.length > 0 || state.selectedObjectIds.length > 0
        if (hasSelection) {
          focusSelectedRef.current = true
          if (!viewportFocused && canvas) (canvas as HTMLCanvasElement).focus()
          e.preventDefault()
        }
      }
      if (PAN_KEYS.has(key) && viewportFocused) {
        if (key === 'r') {
          resetViewRef.current = true
        } else if (key === 'f') {
          focusSelectedRef.current = true
        } else {
          keysPressed.add(key)
        }
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.key.toLowerCase())
    }
    
    // Store keyboard handlers in ref
    eventHandlersRef.current.onKeyDown = onKeyDown
    eventHandlersRef.current.onKeyUp = onKeyUp
    
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let lastTransformVersion = 0 // Track transform version for lightweight change detection
    let isAnimating = false // Track if actively animating
    let framesSinceLastCheck = 0 // Throttle transform checks
    const TRANSFORM_CHECK_INTERVAL = 10 // Check every N frames instead of every frame
    
    // Create a version counter in store to track changes
    const getTransformVersion = () => {
      const state = useEditorStore.getState()
      const { gameObjects, rootObjectIds } = state
      if (rootObjectIds.length === 0) return 0
      const workspace = gameObjects[rootObjectIds[0]]
      if (!workspace?.children) return 0
      // Simple sum-based version - much faster than JSON.stringify
      return workspace.children.reduce((sum, id) => {
        const obj = gameObjects[id]
        if (!obj?.transform) return sum
        const t = obj.transform
        return sum + t.position.x + t.position.y + t.position.z + 
               t.rotation.x + t.rotation.y + t.rotation.z +
               t.scale.x + t.scale.y + t.scale.z
      }, 0)
    }

    const syncObjects = () => {
      const group = modelsGroupRef.current
      if (!group) return false
      
      const state = useEditorStore.getState()
      const { gameObjects, rootObjectIds } = state
      if (rootObjectIds.length === 0) return false
      
      const workspace = gameObjects[rootObjectIds[0]]
      if (!workspace?.children) return false
      
      const DEG2RAD = Math.PI / 180
      let changed = false

      workspace.children.forEach((objId) => {
        const obj = gameObjects[objId]
        if (!obj?.transform) return
        
        const root = group.children.find(
          (c) => (c.userData.objectId as string) === objId
        ) as THREE.Object3D | undefined
        if (!root) return
        
        root.userData.assetName = obj.name
        const { position, rotation, scale } = obj.transform
        
        // Only update if values changed
        if (root.position.x !== position.x || root.position.y !== position.y || root.position.z !== position.z) {
          root.position.set(position.x, position.y, position.z)
          changed = true
        }
        
        const newRotX = rotation.x * DEG2RAD
        const newRotY = rotation.y * DEG2RAD
        const newRotZ = rotation.z * DEG2RAD
        if (root.rotation.x !== newRotX || root.rotation.y !== newRotY || root.rotation.z !== newRotZ) {
          root.rotation.set(newRotX, newRotY, newRotZ)
          changed = true
        }
        
        const baseScale = (root.userData.baseScale as number) ?? 1
        const newScaleX = baseScale * scale.x
        const newScaleY = baseScale * scale.y
        const newScaleZ = baseScale * scale.z
        if (root.scale.x !== newScaleX || root.scale.y !== newScaleY || root.scale.z !== newScaleZ) {
          root.scale.set(newScaleX, newScaleY, newScaleZ)
          changed = true
        }
      })
      
      return changed
    }

    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)
      const now = performance.now()
      const delta = (now - lastPanTime) / 1000
      lastPanTime = now

      let cameraChanged = false

      if (resetViewRef.current && cameraRef.current) {
        resetViewRef.current = false
        target.copy(INITIAL_TARGET)
        radius = INITIAL_RADIUS
        theta = INITIAL_THETA
        phi = INITIAL_PHI
        updateCameraFromOrbit()
        cameraChanged = true
        isAnimating = false
      }

      if (focusSelectedRef.current && cameraRef.current && modelsGroupRef.current) {
        focusSelectedRef.current = false
        const group = modelsGroupRef.current
        // Read current selection from store; animate loop has no deps so closure would be stale
        const currentNames = useEditorStore.getState().viewportSelectedAssetNames
        const selectedNames = new Set(currentNames)
        
        if (selectedNames.size > 0) {
          // Find the selected object(s)
          const selectedObjects = group.children.filter((child) => {
            const name = child.userData.assetName as string | undefined
            return name && selectedNames.has(name)
          })
          
          if (selectedObjects.length > 0) {
            // Calculate bounding box for all selected objects
            const box = new THREE.Box3()
            selectedObjects.forEach((obj) => box.expandByObject(obj))
            
            // Get center and size
            const center = new THREE.Vector3()
            box.getCenter(center)
            const size = new THREE.Vector3()
            box.getSize(size)
            
            // Move target to center of selection
            target.copy(center)
            
            // Calculate appropriate distance to fit object in view
            const maxDim = Math.max(size.x, size.y, size.z)
            radius = Math.max(maxDim * 2, MIN_RADIUS)
            
            updateCameraFromOrbit()
            cameraChanged = true
            isAnimating = false
          }
        }
      }

      if (keysPressed.size > 0 && cameraRef.current) {
        const speed = PAN_SPEED * (delta * 60)
        const forward = new THREE.Vector3()
          .subVectors(camera.position, target)
          .setY(0)
        if (forward.lengthSq() > 1e-6) {
          forward.normalize()
          const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
          if (keysPressed.has('w')) target.addScaledVector(forward, -speed)
          if (keysPressed.has('s')) target.addScaledVector(forward, speed)
          if (keysPressed.has('a')) target.addScaledVector(right, -speed)
          if (keysPressed.has('d')) target.addScaledVector(right, speed)
        }
        if (keysPressed.has('e')) target.y += speed
        if (keysPressed.has('q')) target.y -= speed
        updateCameraFromOrbit()
        cameraChanged = true
        isAnimating = true
      } else if (isAnimating && keysPressed.size === 0) {
        isAnimating = false
      }

      // Check for transform updates only when idle (no camera movement)
      // Throttle checks to every N frames for better performance
      if (!isAnimating && !cameraChanged) {
        framesSinceLastCheck++
        if (framesSinceLastCheck >= TRANSFORM_CHECK_INTERVAL) {
          framesSinceLastCheck = 0
          const currentVersion = getTransformVersion()
          if (currentVersion !== lastTransformVersion) {
            lastTransformVersion = currentVersion
            const changed = syncObjects()
            if (changed) {
              needsRender = true
            }
          }
        }
      } else {
        // Reset counter when animating to check immediately after animation stops
        framesSinceLastCheck = 0
      }

      // Check if external trigger requested render
      if (needsRenderRef.current) {
        needsRender = true
        needsRenderRef.current = false
      }

      // Only render when needed
      if (needsRender || cameraChanged || isAnimating) {
        if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current)
        }
        if (!isAnimating) {
          needsRender = false
        }
      }
    }
    animate()
    
    // Force initial render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
      console.log('[Viewport3D] Initial render complete')
    }

    const onResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
      
      // Throttle resize to avoid too many updates
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
      
      resizeTimeoutRef.current = window.setTimeout(() => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        
        if (w === 0 || h === 0) {
          console.warn('[Viewport3D] Resize to zero dimensions, skipping')
          return
        }
        
        console.log('[Viewport3D] Resizing to', { w, h })
        cameraRef.current.aspect = w / h
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(w, h)
        enforceCanvasLock()
        needsRenderRef.current = true
      }, 100)
    }
    
    // Store resize handler in ref
    eventHandlersRef.current.onResize = onResize
    
    window.addEventListener('resize', onResize)

    resizeObserverRef.current = new ResizeObserver(onResize)
    resizeObserverRef.current.observe(container)
    
    console.log('[Viewport3D] ✅ Initialization complete!')
    
    } catch (error) {
      console.error('[Viewport3D] ❌ Initialization failed:', error)
      initializedRef.current = false
      return
    }

    return () => {
      console.log('[Viewport3D] Cleaning up Three.js scene')
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      
      const canvas = canvasRef.current
      const handlers = eventHandlersRef.current
      
      if (canvas && handlers) {
        if (handlers.onPointerDown) canvas.removeEventListener('pointerdown', handlers.onPointerDown)
        if (handlers.onPointerMove) canvas.removeEventListener('pointermove', handlers.onPointerMove)
        if (handlers.onPointerUp) canvas.removeEventListener('pointerup', handlers.onPointerUp)
        if (handlers.onPointerEnter) canvas.removeEventListener('pointerenter', handlers.onPointerEnter)
        if (handlers.onPointerLeave) canvas.removeEventListener('pointerleave', handlers.onPointerLeave)
        if (handlers.onWheel) canvas.removeEventListener('wheel', handlers.onWheel, handlers.wheelOpts as object)
      }
      
      if (handlers) {
        if (handlers.onPointerMove) window.removeEventListener('pointermove', handlers.onPointerMove)
        if (handlers.onPointerUp) window.removeEventListener('pointerup', handlers.onPointerUp)
        if (handlers.onKeyDown) window.removeEventListener('keydown', handlers.onKeyDown)
        if (handlers.onKeyUp) window.removeEventListener('keyup', handlers.onKeyUp)
        if (handlers.onResize) window.removeEventListener('resize', handlers.onResize)
      }
      
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      
      const wrapper = wrapperRef.current
      if (containerRef.current && wrapper && wrapper.parentNode === containerRef.current) {
        containerRef.current.removeChild(wrapper)
      }
      
      rendererRef.current?.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      modelsGroupRef.current = null
      canvasRef.current = null
      wrapperRef.current = null
      eventHandlersRef.current = {}
      initializedRef.current = false
      console.log('[Viewport3D] Cleanup complete')
    }
    // Empty deps - only initialize once, never cleanup unless component unmounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Highlight selected assets
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group) return
    const names = new Set(viewportSelectedAssetNames)
    group.children.forEach((root) => {
      const name = root.userData.assetName as string | undefined
      setHighlight(root, !!name && names.has(name))
    })
    // Force a render to show the highlight changes
    needsRenderRef.current = true
  }, [viewportSelectedAssetNames])

  // Create/update/remove primitive meshes for AI-created objects (box, sphere, cylinder, etc.)
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group || rootObjectIds.length === 0) return

    const workspaceId = rootObjectIds[0]
    const workspace = gameObjects[workspaceId]
    if (!workspace?.children) return

    const childSet = new Set(workspace.children)
    const DEG2RAD = Math.PI / 180

    // Remove Three.js objects for deleted game objects (primitives only)
    const toRemove: THREE.Object3D[] = []
    group.children.forEach((child) => {
      const objId = child.userData.objectId as string | undefined
      if (objId && !childSet.has(objId)) {
        // Check if this was a primitive (has isPrimitive flag)
        if (child.userData.isPrimitive) {
          toRemove.push(child)
        }
      }
    })
    toRemove.forEach((child) => {
      group.remove(child)
      child.traverse((node: THREE.Object3D) => {
        if ((node as THREE.Mesh).isMesh) {
          const mesh = node as THREE.Mesh
          mesh.geometry?.dispose()
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
          else mesh.material?.dispose()
        }
      })
      needsRenderRef.current = true
    })

    workspace.children.forEach((objId) => {
      const obj = gameObjects[objId]
      if (!obj?.primitiveType) return

      // If a Three.js object already exists, sync its material properties
      const existing = group.children.find(
        (c) => (c.userData.objectId as string) === objId
      )
      if (existing) {
        // Update color/material on existing primitives
        existing.traverse((node: THREE.Object3D) => {
          if ((node as THREE.Mesh).isMesh) {
            const mat = (node as THREE.Mesh).material as THREE.MeshStandardMaterial
            if (mat?.color && obj.color) {
              const newColor = new THREE.Color(obj.color)
              if (!mat.color.equals(newColor)) {
                mat.color.copy(newColor)
                mat.needsUpdate = true
                needsRenderRef.current = true
              }
            }
          }
        })
        return
      }

      // Create the appropriate geometry
      let geometry: THREE.BufferGeometry
      switch (obj.primitiveType) {
        case 'sphere':
          geometry = new THREE.SphereGeometry(0.5, 32, 32)
          break
        case 'cylinder':
          geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
          break
        case 'cone':
          geometry = new THREE.ConeGeometry(0.5, 1, 32)
          break
        case 'torus':
          geometry = new THREE.TorusGeometry(0.4, 0.15, 16, 32)
          break
        case 'plane':
          geometry = new THREE.PlaneGeometry(1, 1)
          break
        case 'box':
        default:
          geometry = new THREE.BoxGeometry(1, 1, 1)
          break
      }

      const color = obj.color || '#888888'
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.6,
        metalness: obj.reflectance ?? 0.1,
        transparent: (obj.transparency ?? 0) > 0,
        opacity: 1 - (obj.transparency ?? 0),
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Wrap in a group so the structure matches GLB-loaded models
      const root = new THREE.Group()
      root.add(mesh)
      root.userData.assetName = obj.name
      root.userData.objectId = objId
      root.userData.baseScale = 1
      root.userData.isPrimitive = true

      // Apply transform
      const { position, rotation, scale } = obj.transform
      root.position.set(position.x, position.y, position.z)
      root.rotation.set(
        rotation.x * DEG2RAD,
        rotation.y * DEG2RAD,
        rotation.z * DEG2RAD
      )
      root.scale.set(scale.x, scale.y, scale.z)

      group.add(root)
      needsRenderRef.current = true
    })
  }, [gameObjects, rootObjectIds])

  // Replace meshes when meshUrl is set (user-selected file)
  useEffect(() => {
    const group = modelsGroupRef.current
    if (!group || rootObjectIds.length === 0) return

    const workspaceId = rootObjectIds[0]
    const workspace = gameObjects[workspaceId]
    if (!workspace?.children) return

    const MODEL_SCALE = 2
    const fitScale = (obj: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(obj)
      const size = box.getSize(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      if (maxDim <= 0) return 1
      return MODEL_SCALE / maxDim
    }

    const loader = new GLTFLoader()
    const DEG2RAD = Math.PI / 180

    workspace.children.forEach((objId) => {
      const obj = gameObjects[objId]
      if (!obj?.meshUrl) {
        delete loadedMeshUrlsRef.current[objId]
        return
      }
      if (loadedMeshUrlsRef.current[objId] === obj.meshUrl) return

      const oldRoot = group.children.find(
        (c) => (c.userData.objectId as string) === objId
      ) as THREE.Object3D | undefined
      if (!oldRoot) return

      loadedMeshUrlsRef.current[objId] = obj.meshUrl

      loader.load(
        obj.meshUrl,
        (gltf: { scene: THREE.Group }) => {
          const newRoot = gltf.scene
          const baseScale = fitScale(newRoot)
          newRoot.userData.assetName = obj.name
          newRoot.userData.objectId = objId
          newRoot.userData.baseScale = baseScale
          newRoot.traverse((node: THREE.Object3D) => {
            if ((node as THREE.Mesh).isMesh) {
              (node as THREE.Mesh).castShadow = true
              ;(node as THREE.Mesh).receiveShadow = true
            }
          })

          const { position, rotation, scale } = obj.transform
          newRoot.position.set(position.x, position.y, position.z)
          newRoot.rotation.set(
            rotation.x * DEG2RAD,
            rotation.y * DEG2RAD,
            rotation.z * DEG2RAD
          )
          newRoot.scale.set(
            baseScale * scale.x,
            baseScale * scale.y,
            baseScale * scale.z
          )

          group.remove(oldRoot)
          group.add(newRoot)
          ;(oldRoot as THREE.Object3D).traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const mesh = node as THREE.Mesh
              mesh.geometry?.dispose()
              if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose())
              else mesh.material?.dispose()
            }
          })
        },
        undefined,
        () => {}
      )
    })
  }, [gameObjects, rootObjectIds])

  return null
})
