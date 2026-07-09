import { useEffect, useRef, useState } from 'react'
import { DockablePanel } from '../shared/DockablePanel'
import { MenuDropdown } from '../shared/MenuDropdown'
import { PropertiesLabel } from '../shared/PropertiesLabel'
import { ExpandDownIcon, ExpandRightIcon } from '../shared/ExpandIcons'
import { ModelPreview } from './ModelPreview'
import { TexturePreview } from './TexturePreview'
import { THREE_SPACE_ASSETS } from '../Viewport/threeSpaceAssets'
import { useEditorStore } from '../../store/editorStore'
import styles from './Inspector.module.css'

function toNumericId(seed: string, length: number): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString().padStart(length, '0').slice(-length)
}

function toMeshId(uuid: string): string {
  return toNumericId(uuid, 10)
}

function toTextureId(uuid: string): string {
  return toNumericId(`${uuid}:texture`, 9)
}

function extractFileName(path: string): string {
  if (!path) return path
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').pop() ?? path
}

function getSourceFilename(modelName: string): string {
  const match = THREE_SPACE_ASSETS.find((f) => f.replace(/\.glb$/i, '') === modelName)
  return match ?? ''
}

const MESH_ACCEPT = '.glb,.gltf,.obj,.fbx,.dae'
const TEXTURE_ACCEPT = '.png,.jpg,.jpeg,.webp,.tga,.tif,.tiff,.bmp'

export function Inspector() {
  const [transformExpanded, setTransformExpanded] = useState(true)
  const [pivotExpanded, setPivotExpanded] = useState(true)
  const [appearanceExpanded, setAppearanceExpanded] = useState(true)
  const [textureFilename, setTextureFilename] = useState('—')
  const [textureObjectUrl, setTextureObjectUrl] = useState<string | null>(null)
  const [compactDropdownOpen, setCompactDropdownOpen] = useState(false)
  const [compactDropdownValue, setCompactDropdownValue] = useState('Precise')
  const [colorHexInput, setColorHexInput] = useState('')
  const [materialExpanded, setMaterialExpanded] = useState(true)
  const [physicsExpanded, setPhysicsExpanded] = useState(true)
  const [importSettingsExpanded, setImportSettingsExpanded] = useState(true)
  const [physicsCollisionOpen, setPhysicsCollisionOpen] = useState(false)
  const [importRigTypeOpen, setImportRigTypeOpen] = useState(false)
  const [importWorldForwardOpen, setImportWorldForwardOpen] = useState(false)
  const [importWorldUpOpen, setImportWorldUpOpen] = useState(false)
  const [importScaleUnitOpen, setImportScaleUnitOpen] = useState(false)
  const meshFileInputRef = useRef<HTMLInputElement>(null)
  const textureFileInputRef = useRef<HTMLInputElement>(null)
  const importPathInputRef = useRef<HTMLInputElement>(null)
  const compactDropdownRef = useRef<HTMLDivElement>(null)
  const physicsCollisionRef = useRef<HTMLDivElement>(null)
  const importRigTypeRef = useRef<HTMLDivElement>(null)
  const importWorldForwardRef = useRef<HTMLDivElement>(null)
  const importWorldUpRef = useRef<HTMLDivElement>(null)
  const importScaleUnitRef = useRef<HTMLDivElement>(null)

  const {
    selectedObjectIds,
    gameObjects,
    rootObjectIds,
    updateGameObject,
    viewportSelectedAssetNames,
  } = useEditorStore()
  const primaryId = selectedObjectIds.length > 0 ? selectedObjectIds[selectedObjectIds.length - 1] : null
  let selectedObject = primaryId ? gameObjects[primaryId] : null
  const primaryAssetName =
    viewportSelectedAssetNames.length > 0 ? viewportSelectedAssetNames[viewportSelectedAssetNames.length - 1] : null
  const hasMulti = selectedObjectIds.length > 1 || viewportSelectedAssetNames.length > 1

  // Fallback: when viewport selected an asset by name but selectedObjectIds wasn't set,
  // find the game object by name in the workspace tree so we can show transform editing
  if (primaryAssetName && !selectedObject && rootObjectIds.length > 0) {
    const workspace = gameObjects[rootObjectIds[0]]
    const findByName = (ids: string[]): string | null => {
      for (const id of ids) {
        if (gameObjects[id]?.name === primaryAssetName) return id
        const child = gameObjects[id]
        if (child?.children?.length) {
          const found = findByName(child.children)
          if (found) return found
        }
      }
      return null
    }
    const fallbackId = workspace ? findByName(workspace.children) : null
    if (fallbackId) selectedObject = gameObjects[fallbackId] ?? null
  }

  const effectivePrimaryId = selectedObject?.id ?? primaryId ?? null
  const textureId = selectedObject ? toTextureId(selectedObject.id) : toTextureId('texture')

  useEffect(() => {
    if (selectedObject?.texturePath) {
      setTextureFilename(selectedObject.texturePath)
    } else {
      setTextureFilename('—')
    }
    setTextureObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
  }, [selectedObject?.id, selectedObject?.texturePath])

  useEffect(() => {
    setColorHexInput((selectedObject?.color ?? '#ffffff').toUpperCase())
  }, [selectedObject?.id, selectedObject?.color])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (compactDropdownRef.current && !compactDropdownRef.current.contains(target)) setCompactDropdownOpen(false)
      if (physicsCollisionRef.current && !physicsCollisionRef.current.contains(target)) setPhysicsCollisionOpen(false)
      if (importRigTypeRef.current && !importRigTypeRef.current.contains(target)) setImportRigTypeOpen(false)
      if (importWorldForwardRef.current && !importWorldForwardRef.current.contains(target)) setImportWorldForwardOpen(false)
      if (importWorldUpRef.current && !importWorldUpRef.current.contains(target)) setImportWorldUpOpen(false)
      if (importScaleUnitRef.current && !importScaleUnitRef.current.contains(target)) setImportScaleUnitOpen(false)
    }
    const open = compactDropdownOpen || physicsCollisionOpen || importRigTypeOpen || importWorldForwardOpen || importWorldUpOpen || importScaleUnitOpen
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [compactDropdownOpen, physicsCollisionOpen, importRigTypeOpen, importWorldForwardOpen, importWorldUpOpen, importScaleUnitOpen])

  if (!selectedObject && !primaryAssetName) {
    return (
      <DockablePanel widgetId="inspector" title="Properties" className={styles.propertiesPanel}>
        <div className={styles.empty}>
          <p>Select an object to inspect</p>
        </div>
      </DockablePanel>
    )
  }

  if (primaryAssetName && !selectedObject) {
    return (
      <DockablePanel widgetId="inspector" title="Properties" className={styles.propertiesPanel}>
        <div className={styles.content}>
          {hasMulti && (
            <p style={{ fontSize: 12, color: 'var(--content-muted)', margin: '8px 12px' }}>
              {selectedObjectIds.length || viewportSelectedAssetNames.length} selected. Inspecting last selected.
            </p>
          )}
          <section className={`${styles.section} ${styles.headerSection}`}>
            <div className={styles.header}>
              <div className={styles.checkboxWrapper} />
              <input
                type="text"
                value={primaryAssetName}
                readOnly
                className={styles.nameInput}
              />
            </div>
          </section>
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <ExpandDownIcon />
              <span>Transform</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--content-muted)', margin: '8px 0 0' }}>
              Transform editing for viewport assets coming soon.
            </p>
          </section>
        </div>
      </DockablePanel>
    )
  }

  if (!selectedObject) return null

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (effectivePrimaryId) updateGameObject(effectivePrimaryId, { name: e.target.value })
  }

  const handleMeshFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !effectivePrimaryId) return
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const meshUrl = URL.createObjectURL(file)
    if (selectedObject?.meshUrl) URL.revokeObjectURL(selectedObject.meshUrl)
    updateGameObject(effectivePrimaryId, { name: baseName, meshUrl, meshFilename: file.name })
  }

  const handleTextureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !effectivePrimaryId) return
    updateGameObject(effectivePrimaryId, { texturePath: file.name })
    setTextureFilename(file.name)
    setTextureObjectUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }

  const handleImportPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !effectivePrimaryId) return
    const fileWithPath = file as File & { path?: string }
    const path =
      fileWithPath.path ??
      (file.webkitRelativePath ? file.webkitRelativePath.replace(/\/[^/]+$/, '') : null) ??
      file.name
    updateGameObject(effectivePrimaryId, { importPath: path })
  }

  const openImportPathPicker = () => importPathInputRef.current?.click()

  const handleTransformChange = (
    component: 'position' | 'rotation' | 'scale',
    axis: 'x' | 'y' | 'z',
    value: string
  ) => {
    if (!effectivePrimaryId) return
    const numValue = parseFloat(value) || 0
    updateGameObject(effectivePrimaryId, {
      transform: {
        ...selectedObject.transform,
        [component]: {
          ...selectedObject.transform[component],
          [axis]: numValue,
        },
      },
    })
  }

  const handlePivotChange = (
    component: 'position' | 'rotation',
    axis: 'x' | 'y' | 'z',
    value: string
  ) => {
    if (!effectivePrimaryId) return
    const pivot = selectedObject.pivot ?? { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }
    const numValue = parseFloat(value) || 0
    updateGameObject(effectivePrimaryId, {
      pivot: {
        ...pivot,
        [component]: {
          ...pivot[component],
          [axis]: numValue,
        },
      },
    })
  }

  return (
    <DockablePanel widgetId="inspector" title="Properties" className={styles.propertiesPanel}>
      <input
        ref={meshFileInputRef}
        type="file"
        accept={MESH_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleMeshFileChange}
        aria-label="Select mesh file"
      />
      <input
        ref={textureFileInputRef}
        type="file"
        accept={TEXTURE_ACCEPT}
        style={{ display: 'none' }}
        onChange={handleTextureFileChange}
        aria-label="Select texture file"
      />
      <input
        ref={importPathInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleImportPathChange}
        aria-label="Select import path"
      />
      <div className={styles.content}>
        {/* Header section */}
        <section className={`${styles.section} ${styles.headerSection}`}>
            {hasMulti && (
              <p style={{ fontSize: 12, color: 'var(--content-muted)', margin: '8px 12px' }}>
                {selectedObjectIds.length} selected. Inspecting last selected.
              </p>
            )}
            <div className={styles.header}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  checked={selectedObject.visible}
                  onChange={(e) =>
                    effectivePrimaryId && updateGameObject(effectivePrimaryId, { visible: e.target.checked })
                  }
                  className={styles.checkbox}
                />
              </div>
            <input
              type="text"
              value={selectedObject.name}
              onChange={handleNameChange}
              className={styles.nameInput}
            />
          </div>
        </section>

        {/* Transform section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setTransformExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setTransformExpanded((v) => !v)}
          >
            {transformExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Transform</span>
          </div>
          
          {transformExpanded && (
          <div className={styles.transformGrid}>
            <TransformRow
              label="Position"
              values={selectedObject.transform.position}
              onChange={(axis, value) => handleTransformChange('position', axis, value)}
            />
            <TransformRow
              label="Orientation"
              values={selectedObject.transform.rotation}
              onChange={(axis, value) => handleTransformChange('rotation', axis, value)}
              unit="degrees"
            />
            <TransformRow
              label="Size"
              values={selectedObject.transform.scale}
              onChange={(axis, value) => handleTransformChange('scale', axis, value)}
            />
          </div>
          )}
        </section>

        {/* Pivot section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setPivotExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setPivotExpanded((v) => !v)}
          >
            {pivotExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Pivot</span>
          </div>
          {pivotExpanded && (
          <div className={styles.transformGrid}>
            <TransformRow
              label="Position"
              values={selectedObject.pivot?.position ?? { x: 0, y: 0, z: 0 }}
              onChange={(axis, value) => handlePivotChange('position', axis, value)}
            />
            <TransformRow
              label="Orientation"
              values={selectedObject.pivot?.rotation ?? { x: 0, y: 0, z: 0 }}
              onChange={(axis, value) => handlePivotChange('rotation', axis, value)}
              unit="degrees"
            />
          </div>
          )}
        </section>

        <div className={styles.sectionDivider} />

        {/* Appearance section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setAppearanceExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setAppearanceExpanded((v) => !v)}
          >
            {appearanceExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Appearance</span>
          </div>
          {appearanceExpanded && (
            <div className={styles.transformGrid}>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Mesh ID</label>
                <PropertiesLabel value={toMeshId(selectedObject.id)} />
              </div>
              <div className={styles.previewerContainer}>
                <ModelPreview
                  modelName={selectedObject.name}
                  modelUrl={selectedObject.meshUrl}
                  className={styles.previewImage}
                />
              </div>
              <div className={`${styles.transformRow} ${styles.sourceInputRow}`}>
                <PropertiesLabel value={selectedObject.meshFilename ?? (getSourceFilename(selectedObject.name) || '—')} />
                <button
                  type="button"
                  className={styles.sourceIconButton}
                  onClick={() => meshFileInputRef.current?.click()}
                  title="Select mesh file"
                  aria-label="Select mesh file"
                >
                  <img src="/icons/QuickOpen.svg" alt="" width={16} height={16} className={styles.sourceIcon} />
                </button>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Texture ID</label>
                <PropertiesLabel value={textureId} />
              </div>
              <div className={styles.previewerContainer}>
                <TexturePreview
                  modelName={selectedObject.name}
                  className={styles.textureCanvas}
                  textureUrl={textureObjectUrl ?? undefined}
                  onTextureInfo={(info) => {
                    if (!selectedObject?.texturePath) {
                      setTextureFilename(info?.name ? extractFileName(info.name) : '—')
                    }
                  }}
                />
              </div>
              <div className={`${styles.transformRow} ${styles.sourceInputRow}`}>
                <PropertiesLabel value={textureFilename} />
                <button
                  type="button"
                  className={styles.sourceIconButton}
                  onClick={() => textureFileInputRef.current?.click()}
                  title="Select texture file"
                  aria-label="Select texture file"
                >
                  <img src="/icons/QuickOpen.svg" alt="" width={16} height={16} className={styles.sourceIcon} />
                </button>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={compactDropdownRef}>
                <label className={styles.transformLabel}>Render Fidelity</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setCompactDropdownOpen((v) => !v)}
                    aria-expanded={compactDropdownOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{compactDropdownValue}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                  items={[
                    { label: 'Precise', onClick: () => { setCompactDropdownValue('Precise'); setCompactDropdownOpen(false) } },
                    { label: 'Test Here', onClick: () => { setCompactDropdownValue('Test Here'); setCompactDropdownOpen(false) } },
                    { label: 'Run', onClick: () => { setCompactDropdownValue('Run'); setCompactDropdownOpen(false) } },
                  ]}
                  isOpen={compactDropdownOpen}
                  onClose={() => setCompactDropdownOpen(false)}
                />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Double Sided</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.doubleSided ?? false}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { doubleSided: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Color</label>
                <div className={styles.colorInputWrap}>
                  <input
                    type="color"
                    value={selectedObject.color ?? '#ffffff'}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { color: e.target.value })
                    }
                    className={styles.colorInput}
                    aria-label="Color"
                  />
                  <input
                    type="text"
                    value={colorHexInput}
                    onChange={(e) => setColorHexInput(e.target.value)}
                    onBlur={() => {
                      const raw = colorHexInput.trim()
                      const hex = raw.startsWith('#') ? raw : `#${raw}`
                      if (/^#[0-9A-Fa-f]{6}$/.test(hex) && effectivePrimaryId) {
                        updateGameObject(effectivePrimaryId, { color: hex })
                        setColorHexInput(hex.toUpperCase())
                      } else {
                        setColorHexInput((selectedObject?.color ?? '#ffffff').toUpperCase())
                      }
                    }}
                    className={styles.colorHexInput}
                    aria-label="Color hex"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Material section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setMaterialExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setMaterialExpanded((v) => !v)}
          >
            {materialExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Material</span>
          </div>
          {materialExpanded && (
            <div className={styles.transformGrid}>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Material</label>
                <div className={styles.colorInputWrap}>
                  <input
                    type="color"
                    value={selectedObject.color ?? '#e5e5e5'}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { color: e.target.value })
                    }
                    className={styles.colorInput}
                    aria-label="Material color"
                  />
                  <input
                    type="text"
                    value={selectedObject.material ?? 'Plastic'}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { material: e.target.value })
                    }
                    className={styles.colorHexInput}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.sliderRow}`}>
                <label className={styles.transformLabel}>Reflectance</label>
                <div className={styles.sliderWrap}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedObject.reflectance ?? 0.56}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, {
                        reflectance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={styles.sliderTrack}
                    aria-label="Reflectance"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedObject.reflectance ?? 0.56}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, {
                        reflectance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={styles.sliderNumber}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.sliderRow}`}>
                <label className={styles.transformLabel}>Transparency</label>
                <div className={styles.sliderWrap}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedObject.transparency ?? 0.12}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, {
                        transparency: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={styles.sliderTrack}
                    aria-label="Transparency"
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={selectedObject.transparency ?? 0.12}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, {
                        transparency: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={styles.sliderNumber}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Cast Shadow</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.castShadow ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { castShadow: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Physics section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setPhysicsExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setPhysicsExpanded((v) => !v)}
          >
            {physicsExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Physics</span>
          </div>
          {physicsExpanded && (
            <div className={styles.transformGrid}>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Anchored</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.anchored ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { anchored: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Can Collide</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.canCollide ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { canCollide: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Can Touch</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.canTouch ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { canTouch: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={physicsCollisionRef}>
                <label className={styles.transformLabel}>Collision Group</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setPhysicsCollisionOpen((v) => !v)}
                    aria-expanded={physicsCollisionOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{selectedObject.collisionGroup ?? 'None'}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                    items={[
                      { label: 'None', onClick: () => { updateGameObject(effectivePrimaryId!, { collisionGroup: 'None' }); setPhysicsCollisionOpen(false) } },
                      { label: 'Default', onClick: () => { updateGameObject(effectivePrimaryId!, { collisionGroup: 'Default' }); setPhysicsCollisionOpen(false) } },
                    ]}
                    isOpen={physicsCollisionOpen}
                    onClose={() => setPhysicsCollisionOpen(false)}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Fluid Forces</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.fluidForces ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { fluidForces: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Massless</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.massless ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { massless: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Import Settings section */}
        <section className={styles.section}>
          <div
            className={styles.sectionHeader}
            role="button"
            tabIndex={0}
            onClick={() => setImportSettingsExpanded((v) => !v)}
            onKeyDown={(e) => e.key === 'Enter' && setImportSettingsExpanded((v) => !v)}
          >
            {importSettingsExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
            <span>Import Settings</span>
          </div>
          {importSettingsExpanded && (
            <div className={styles.transformGrid}>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Path</label>
                <div className={styles.pathInputWrap}>
                  <input
                    type="text"
                    value={selectedObject.importPath ?? '/Users/.../Blender_Projects/'}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { importPath: e.target.value })
                    }
                    onClick={openImportPathPicker}
                    readOnly
                    className={styles.pathInput}
                    placeholder="Path"
                  />
                  <button
                    type="button"
                    className={styles.sourceIconButton}
                    onClick={openImportPathPicker}
                    title="Browse"
                    aria-label="Browse"
                  >
                    <span className={styles.pathBrowseDots}>…</span>
                  </button>
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Import only as a Model</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.importOnlyAsModel ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { importOnlyAsModel: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Upload to Roblox</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.uploadToRoblox ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { uploadToRoblox: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Import as Package</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.importAsPackage ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { importAsPackage: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={importRigTypeRef}>
                <label className={styles.transformLabel}>Rig Type</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setImportRigTypeOpen((v) => !v)}
                    aria-expanded={importRigTypeOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{selectedObject.rigType ?? 'No Rig'}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                    items={[
                      { label: 'No Rig', onClick: () => { updateGameObject(effectivePrimaryId!, { rigType: 'No Rig' }); setImportRigTypeOpen(false) } },
                      { label: 'R6', onClick: () => { updateGameObject(effectivePrimaryId!, { rigType: 'R6' }); setImportRigTypeOpen(false) } },
                      { label: 'R15', onClick: () => { updateGameObject(effectivePrimaryId!, { rigType: 'R15' }); setImportRigTypeOpen(false) } },
                    ]}
                    isOpen={importRigTypeOpen}
                    onClose={() => setImportRigTypeOpen(false)}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={importWorldForwardRef}>
                <label className={styles.transformLabel}>World Forward</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setImportWorldForwardOpen((v) => !v)}
                    aria-expanded={importWorldForwardOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{selectedObject.worldForward ?? 'Front'}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                    items={[
                      { label: 'Front', onClick: () => { updateGameObject(effectivePrimaryId!, { worldForward: 'Front' }); setImportWorldForwardOpen(false) } },
                      { label: 'Back', onClick: () => { updateGameObject(effectivePrimaryId!, { worldForward: 'Back' }); setImportWorldForwardOpen(false) } },
                    ]}
                    isOpen={importWorldForwardOpen}
                    onClose={() => setImportWorldForwardOpen(false)}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={importWorldUpRef}>
                <label className={styles.transformLabel}>World Up</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setImportWorldUpOpen((v) => !v)}
                    aria-expanded={importWorldUpOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{selectedObject.worldUp ?? 'Top'}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                    items={[
                      { label: 'Top', onClick: () => { updateGameObject(effectivePrimaryId!, { worldUp: 'Top' }); setImportWorldUpOpen(false) } },
                      { label: 'Bottom', onClick: () => { updateGameObject(effectivePrimaryId!, { worldUp: 'Bottom' }); setImportWorldUpOpen(false) } },
                    ]}
                    isOpen={importWorldUpOpen}
                    onClose={() => setImportWorldUpOpen(false)}
                  />
                </div>
              </div>
              <div className={`${styles.transformRow} ${styles.renderFidelityRow}`} ref={importScaleUnitRef}>
                <label className={styles.transformLabel}>Scale Unit</label>
                <div className={styles.compactDropdownWrap}>
                  <button
                    type="button"
                    className={styles.compactDropdownButton}
                    onClick={() => setImportScaleUnitOpen((v) => !v)}
                    aria-expanded={importScaleUnitOpen}
                    aria-haspopup="listbox"
                  >
                    <span>{selectedObject.scaleUnit ?? 'Stud'}</span>
                    <ExpandDownIcon />
                  </button>
                  <MenuDropdown
                    items={[
                      { label: 'Stud', onClick: () => { updateGameObject(effectivePrimaryId!, { scaleUnit: 'Stud' }); setImportScaleUnitOpen(false) } },
                      { label: 'Meter', onClick: () => { updateGameObject(effectivePrimaryId!, { scaleUnit: 'Meter' }); setImportScaleUnitOpen(false) } },
                    ]}
                    isOpen={importScaleUnitOpen}
                    onClose={() => setImportScaleUnitOpen(false)}
                  />
                </div>
              </div>
              <div className={styles.transformRow}>
                <label className={styles.transformLabel}>Merge Meshes</label>
                <div className={styles.checkboxWrapper}>
                  <input
                    type="checkbox"
                    checked={selectedObject.mergeMeshes ?? true}
                    onChange={(e) =>
                      effectivePrimaryId &&
                      updateGameObject(effectivePrimaryId, { mergeMeshes: e.target.checked })
                    }
                    className={styles.checkbox}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </DockablePanel>
  )
}

interface TransformRowProps {
  label: string
  values: { x: number; y: number; z: number }
  onChange: (axis: 'x' | 'y' | 'z', value: string) => void
  /** When 'degrees', use step 1 for whole-degree input */
  unit?: 'number' | 'degrees'
}

function TransformRow({ label, values, onChange, unit = 'number' }: TransformRowProps) {
  const step = unit === 'degrees' ? '1' : '0.1'
  const inputWidth = (v: number) => Math.max(3, String(v).length + 1)

  return (
    <div className={styles.transformRow}>
      <label className={styles.transformLabel}>{label}</label>
      <div className={styles.transformInputs}>
        <div className={styles.inputGroup} data-axis="x">
          <span className={styles.axisLine} aria-hidden />
          <div className={`${styles.inputWithUnit} ${unit === 'degrees' ? styles.inputWithDegrees : ''}`}>
            <input
              type="number"
              value={values.x}
              onChange={(e) => onChange('x', e.target.value)}
              className={styles.numberInput}
              step={step}
              style={unit === 'degrees' ? { width: `${inputWidth(values.x)}ch` } : undefined}
            />
            {unit === 'degrees' && <span className={styles.unitSuffix}>°</span>}
          </div>
        </div>
        <div className={styles.inputGroup} data-axis="y">
          <span className={styles.axisLine} aria-hidden />
          <div className={`${styles.inputWithUnit} ${unit === 'degrees' ? styles.inputWithDegrees : ''}`}>
            <input
              type="number"
              value={values.y}
              onChange={(e) => onChange('y', e.target.value)}
              className={styles.numberInput}
              step={step}
              style={unit === 'degrees' ? { width: `${inputWidth(values.y)}ch` } : undefined}
            />
            {unit === 'degrees' && <span className={styles.unitSuffix}>°</span>}
          </div>
        </div>
        <div className={styles.inputGroup} data-axis="z">
          <span className={styles.axisLine} aria-hidden />
          <div className={`${styles.inputWithUnit} ${unit === 'degrees' ? styles.inputWithDegrees : ''}`}>
            <input
              type="number"
              value={values.z}
              onChange={(e) => onChange('z', e.target.value)}
              className={styles.numberInput}
              step={step}
              style={unit === 'degrees' ? { width: `${inputWidth(values.z)}ch` } : undefined}
            />
            {unit === 'degrees' && <span className={styles.unitSuffix}>°</span>}
          </div>
        </div>
      </div>
    </div>
  )
}




