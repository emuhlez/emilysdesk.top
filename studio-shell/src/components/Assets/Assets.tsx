import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Folder,
  Image,
  FileCode,
  Box,
  Layers,
  Film,
  Video,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { ExpandDownIcon, ExpandRightIcon } from '../shared/ExpandIcons'
import searchIconImg from '../../../images/search.png'
import sidebarIconSvg from '/icons/sidebar.svg'
import { DockablePanel } from '../shared/DockablePanel'
import { IconButton } from '../shared/IconButton'
import { ContextMenu, useContextMenu } from '../shared/ContextMenu'
import { MenuDropdown, type MenuItem } from '../shared/MenuDropdown'
import { useEditorStore } from '../../store/editorStore'
import type { Asset } from '../../types'
import { AssetTile } from './AssetTile'
import { MoveDialog } from './MoveDialog'
import { FilterMenu, type ActiveFilters } from './FilterMenu'
import { AssetSearchDialog } from './AssetSearchDialog'
import styles from './Assets.module.css'

const assetIcons: Record<Asset['type'], React.ReactNode> = {
  folder: <Folder size={14} />,
  texture: <Image size={14} />,
  model: <img src="/icons/model.svg" alt="Model" width={14} height={14} />,
  audio: <img src="/icons/audio.svg" alt="Audio" width={14} height={14} />,
  video: <Video size={14} />,
  script: <FileCode size={14} />,
  material: <Layers size={14} />,
  prefab: <Box size={14} />,
  scene: <Film size={14} />,
  animation: <img src="/icons/animation.svg" alt="Animation" width={14} height={14} />,
}

const SPECIAL_NAV_ITEMS = [
  { id: 'recent', label: 'Import Queue', icon: <img src="/icons/recently-imported.svg" alt="Import Queue" width={16} height={16} /> },
  { id: 'import-queue', label: 'Crossy Farm', icon: <img src="/icons/experience-folder.svg" alt="Crossy Farm" width={16} height={16} /> },
] as const

const INVENTORIES_NAV_ID = 'inventories'
const EHOPE_NAV_ID = 'ehopehopehope'
const ALPHA_STRIKE_NAV_ID = 'alpha-strike'

const SIDE_NAV_MIN = 220
const SIDE_NAV_MAX = 400
const SIDE_NAV_DEFAULT = 220
/** When panel width <= this, use narrow layout: sidebar-only by default; toggle opens content; double-click nav row opens content. Resize the left column to this width or less to see it. */
const PANEL_NARROW_THRESHOLD = 330

/** Accepted file extensions for import (excludes gif, pdf) */
const IMPORT_ACCEPT = '.gltf,.glb,.fbx,.obj,.dae,.mp3,.mp4,.m4a,.wav,.ogg,.aac,.flac,.mov,.webm,.avi,.mkv,.png,.jpg,.jpeg,.webp,.tga,.tif,.tiff,.bmp,.js,.ts,.cjs,.mjs,.mat,.prefab,.scene,.anim,.animset'

export function Assets() {
  const { assets, selectedAssetIds, selectAsset, addToImportQueue, importQueue, clearImportQueue, processImportQueue, updateImportQueueItem, renameAsset, createFolder, moveAssetToFolder } = useEditorStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [queueSearchQuery, setQueueSearchQuery] = useState('')
  const [selectedNavId, setSelectedNavId] = useState<string | null>(null)
  const [projectExpanded, setProjectExpanded] = useState(true)
  const [crossyFarmExpanded, setCrossyFarmExpanded] = useState(true)
  const [inventoriesExpanded, setInventoriesExpanded] = useState(true)
  const [sideNavWidth, setSideNavWidth] = useState(SIDE_NAV_DEFAULT)
  const [assetViewMode, setAssetViewMode] = useState<'grid' | 'list'>('grid')
  const resizeStartRef = useRef({ x: 0, w: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queueFileInputRef = useRef<HTMLInputElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const contextMenu = useContextMenu()
  const [contextMenuAssetId, setContextMenuAssetId] = useState<string | null>(null)
  const [lastOpenedFolderId, setLastOpenedFolderId] = useState<string | null>(null)
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const [, setMoveDialogAssetId] = useState<string | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [progressFrame, setProgressFrame] = useState(1)
  const [openCreatorDropdown, setOpenCreatorDropdown] = useState<string | null>(null)
  const [openPresetDropdown, setOpenPresetDropdown] = useState<string | null>(null)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [filterMenuPosition, setFilterMenuPosition] = useState({ top: 0, right: 0 })
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    assetTypes: new Set(),
    sources: new Set(),
    creators: new Set(),
  })
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false)
  const [searchDialogInventory, setSearchDialogInventory] = useState('ehopehopehope')
  const [searchDialogAssetType, setSearchDialogAssetType] = useState('Model')
  const [navigationHistory, setNavigationHistory] = useState<(string | null)[]>([null])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [isSideNavOpen, setIsSideNavOpen] = useState(true)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyWidth, setBodyWidth] = useState(0)
  const queueTableRef = useRef<HTMLTableElement>(null)
  const [importQueueColPcts, setImportQueueColPcts] = useState([20, 20, 20, 20, 20])
  const [resizingQueueColIndex, setResizingQueueColIndex] = useState<number | null>(null)
  const queueResizeStartRef = useRef<{ x: number; pcts: number[] }>({ x: 0, pcts: [] })
  const assetListTableRef = useRef<HTMLTableElement>(null)
  const [assetListColPcts, setAssetListColPcts] = useState([25, 25, 25, 25])
  const [resizingAssetListColIndex, setResizingAssetListColIndex] = useState<number | null>(null)
  const assetListResizeStartRef = useRef<{ x: number; pcts: number[] }>({ x: 0, pcts: [] })

  const topLevelFolders = assets.filter((a): a is Asset => a.type === 'folder')
  const isSpecialNavId = (id: string | null): id is string =>
    id !== null && (SPECIAL_NAV_ITEMS.some((s) => s.id === id) || id === INVENTORIES_NAV_ID || id === EHOPE_NAV_ID || id === ALPHA_STRIKE_NAV_ID)
  const displayAssets: Asset[] =
    selectedNavId === null
      ? assets
      : isSpecialNavId(selectedNavId)
        ? []
        : topLevelFolders.find((f) => f.id === selectedNavId)
          ? [topLevelFolders.find((f) => f.id === selectedNavId)!]
          : assets

  /** Table (Import Queue columns) only for Import Queue; Crossy Farm and others show asset tiles */
  const isImportQueueView = selectedNavId === 'recent'
  
  // Apply filters to assets
  const applyFilters = (assetList: Asset[]): Asset[] => {
    const hasActiveFilters = 
      activeFilters.assetTypes.size > 0 || 
      activeFilters.sources.size > 0 || 
      activeFilters.creators.size > 0

    if (!hasActiveFilters) {
      return assetList
    }

    // Map from FilterMenu labels to Asset types
    const typeMap: Record<string, Asset['type'][]> = {
      'Animation': ['animation'],
      'Audio': ['audio'],
      'Decal': ['texture'],
      'FontFamily': ['material'],
      'Image': ['texture'],
      'Mesh': ['model'],
      'MeshPart': ['model'],
      'Model': ['model'],
      'Only Archived': [], // Special filter - not a type
      'Package': ['prefab'],
      'Plugin': ['script'],
      'Video': ['video'],
    }

    // Check if an asset matches the active filters
    const matchesFilters = (asset: Asset): boolean => {
      // Asset type filter
      if (activeFilters.assetTypes.size > 0) {
        const matchesType = Array.from(activeFilters.assetTypes).some(
          (filterType) => {
            const mappedTypes = typeMap[filterType] || []
            return mappedTypes.includes(asset.type)
          }
        )
        
        if (!matchesType) {
          return false
        }
      }

      // Source filter (placeholder)
      if (activeFilters.sources.size > 0) {
        // For now, allow all assets through if source filter is active
      }

      // Creator filter (placeholder)
      if (activeFilters.creators.size > 0) {
        // For now, allow all assets through if creator filter is active
      }

      return true
    }

    // Recursively check if folder contains matching assets
    const folderContainsMatches = (folder: Asset): boolean => {
      if (!folder.children || folder.children.length === 0) {
        return false
      }

      return folder.children.some((child) => {
        if (child.type === 'folder') {
          return folderContainsMatches(child)
        }
        return matchesFilters(child)
      })
    }

    return assetList.filter((asset) => {
      if (asset.type === 'folder') {
        // Only show folder if it contains matching assets
        return folderContainsMatches(asset)
      }
      
      return matchesFilters(asset)
    })
  }
  
  const assetsForGrid: Asset[] = applyFilters(
    (selectedNavId === 'import-queue'
      ? assets
      : displayAssets.length === 1 && displayAssets[0].type === 'folder'
        ? displayAssets[0].children ?? []
        : displayAssets
    )
  ).sort((a, b) => a.name.localeCompare(b.name))
  
  // Extract visible asset IDs in display order for range selection
  const visibleAssetIds = assetsForGrid.map(a => a.id)

  const getTypeLabel = (a: Asset): string => {
    if (a.type === 'folder') return 'Folder'
    if (a.type === 'texture') return 'Image'
    return a.type.charAt(0).toUpperCase() + a.type.slice(1)
  }

  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    resizeStartRef.current = { x: e.clientX, w: sideNavWidth }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [sideNavWidth])

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return
      const dx = e.clientX - resizeStartRef.current.x
      const next = Math.max(SIDE_NAV_MIN, Math.min(SIDE_NAV_MAX, resizeStartRef.current.w + dx))
      resizeStartRef.current = { x: e.clientX, w: next }
      setSideNavWidth(next)
    },
    []
  )

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  const onQueueColResizeStart = useCallback((index: number, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    queueResizeStartRef.current = { x: e.clientX, pcts: importQueueColPcts }
    setResizingQueueColIndex(index)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [importQueueColPcts])

  useEffect(() => {
    if (resizingQueueColIndex === null) return
    const i = resizingQueueColIndex
    const handleMove = (e: PointerEvent) => {
      const start = queueResizeStartRef.current
      const table = queueTableRef.current
      if (!table) return
      const tableWidth = table.getBoundingClientRect().width
      const fillWidth = tableWidth - 72
      if (fillWidth <= 0) return
      const deltaPct = ((e.clientX - start.x) / fillWidth) * 100
      const total = start.pcts[i] + start.pcts[i + 1]
      const newI = Math.max(5, Math.min(total - 5, start.pcts[i] + deltaPct))
      setImportQueueColPcts((prev) => {
        const next = [...prev]
        next[i] = newI
        next[i + 1] = total - newI
        return next
      })
    }
    const handleUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      setResizingQueueColIndex(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [resizingQueueColIndex])

  const onAssetListColResizeStart = useCallback((index: number, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    assetListResizeStartRef.current = { x: e.clientX, pcts: assetListColPcts }
    setResizingAssetListColIndex(index)
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [assetListColPcts])

  useEffect(() => {
    if (resizingAssetListColIndex === null) return
    const i = resizingAssetListColIndex
    const handleMove = (e: PointerEvent) => {
      const start = assetListResizeStartRef.current
      const table = assetListTableRef.current
      if (!table) return
      const tableWidth = table.getBoundingClientRect().width
      if (tableWidth <= 0) return
      const deltaPct = ((e.clientX - start.x) / tableWidth) * 100
      const total = start.pcts[i] + start.pcts[i + 1]
      const newI = Math.max(5, Math.min(total - 5, start.pcts[i] + deltaPct))
      setAssetListColPcts((prev) => {
        const next = [...prev]
        next[i] = newI
        next[i + 1] = total - newI
        return next
      })
    }
    const handleUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      setResizingAssetListColIndex(null)
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [resizingAssetListColIndex])

  const handleAssetContextMenu = useCallback((assetId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Select the asset if not already selected
    if (!selectedAssetIds.includes(assetId)) {
      selectAsset(assetId, { additive: false, range: false })
    }
    
    setContextMenuAssetId(assetId)
    contextMenu.openContextMenu(e)
  }, [selectedAssetIds, selectAsset, contextMenu])

  const closeContextMenu = useCallback(() => {
    contextMenu.closeContextMenu()
    setContextMenuAssetId(null)
  }, [contextMenu])

  const handleFilterClick = useCallback(() => {
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect()
      setFilterMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setIsFilterMenuOpen(!isFilterMenuOpen)
  }, [isFilterMenuOpen])

  const navigateToFolder = useCallback((folderId: string | null) => {
    setSelectedNavId(folderId)
    // Add to history if it's different from current location
    const currentInHistory = historyIndex >= 0 && historyIndex < navigationHistory.length ? navigationHistory[historyIndex] : null
    if (folderId !== currentInHistory) {
      const newHistory = navigationHistory.slice(0, historyIndex + 1)
      newHistory.push(folderId)
      setNavigationHistory(newHistory)
      setHistoryIndex(newHistory.length - 1)
    }
  }, [navigationHistory, historyIndex])

  const goBack = useCallback(() => {
    // If search is active, clear it first
    if (searchQuery) {
      setSearchQuery('')
      return
    }
    
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1
      setHistoryIndex(newIndex)
      setSelectedNavId(navigationHistory[newIndex])
    }
  }, [historyIndex, navigationHistory, searchQuery])

  const goForward = useCallback(() => {
    if (historyIndex < navigationHistory.length - 1) {
      const newIndex = historyIndex + 1
      setHistoryIndex(newIndex)
      setSelectedNavId(navigationHistory[newIndex])
    }
  }, [historyIndex, navigationHistory])

  const canGoBack = historyIndex > 0 || searchQuery.length > 0
  const canGoForward = historyIndex < navigationHistory.length - 1

  const handleRenameAsset = useCallback((assetId: string) => {
    setRenamingAssetId(assetId)
  }, [])

  const handleConfirmRename = useCallback((assetId: string, newName: string) => {
    if (newName.trim() && newName !== assets.find(a => a.id === assetId)?.name) {
      renameAsset(assetId, newName.trim())
    }
    setRenamingAssetId(null)
  }, [assets, renameAsset])

  const handleCancelRename = useCallback(() => {
    setRenamingAssetId(null)
  }, [])

  const handleSearchDialogOpen = useCallback(() => {
    setIsSearchDialogOpen(true)
  }, [])

  const handleSearchDialogClose = useCallback(() => {
    setIsSearchDialogOpen(false)
  }, [])

  const handleSearchDialogSearch = useCallback((inventory: string, assetType: string) => {
    setSearchDialogInventory(inventory)
    setSearchDialogAssetType(assetType)
    
    // Apply the search filters by setting active filters
    setActiveFilters({
      assetTypes: new Set([assetType]),
      sources: new Set(),
      creators: new Set(),
    })
    
    // TODO: Filter by inventory when inventory system is implemented
    console.log('Search with inventory:', inventory, 'and asset type:', assetType)
  }, [])

  // Drag and drop handlers
  const handleDragStart = useCallback((assetId: string) => {
    // If dragging an unselected asset, select only that asset
    if (!selectedAssetIds.includes(assetId)) {
      selectAsset(assetId, { additive: false, range: false })
    }
  }, [selectedAssetIds, selectAsset])

  const handleDragOver = useCallback((e: React.DragEvent, targetAssetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const targetAsset = assets.find(a => a.id === targetAssetId) || 
                        assets.flatMap(a => a.children || []).find(c => c.id === targetAssetId)
    
    // Only allow dropping on folders
    if (targetAsset?.type === 'folder') {
      setDragOverFolderId(targetAssetId)
    }
  }, [assets])

  const handleDragLeave = useCallback(() => {
    setDragOverFolderId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetAssetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverFolderId(null)

    const targetAsset = assets.find(a => a.id === targetAssetId) || 
                        assets.flatMap(a => a.children || []).find(c => c.id === targetAssetId)
    
    // Only allow dropping on folders
    if (targetAsset?.type === 'folder') {
      // Move all selected assets to the target folder
      selectedAssetIds.forEach(assetId => {
        // Don't move an asset into itself
        if (assetId !== targetAssetId) {
          moveAssetToFolder(assetId, targetAssetId)
        }
      })
    }
  }, [assets, selectedAssetIds, moveAssetToFolder])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Return/Enter key on selected asset to rename
      if (e.key === 'Enter' && selectedAssetIds.length === 1 && !renamingAssetId) {
        e.preventDefault()
        handleRenameAsset(selectedAssetIds[0])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedAssetIds, renamingAssetId, handleRenameAsset])

  // Animate progress circle when importing
  useEffect(() => {
    const hasImporting = importQueue.some(item => item.status === 'importing')
    if (!hasImporting) return

    const interval = setInterval(() => {
      setProgressFrame(prev => prev >= 4 ? 1 : prev + 1)
    }, 500) // Change frame every 500ms

    return () => clearInterval(interval)
  }, [importQueue])

  // Track panel width for responsive layout: narrow => sidebar only by default
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width
        setBodyWidth(w)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // When panel becomes narrow, ensure sidebar is open (otherwise nothing would show)
  useEffect(() => {
    if (bodyWidth > 0 && bodyWidth <= PANEL_NARROW_THRESHOLD) {
      setIsSideNavOpen(true)
    }
  }, [bodyWidth])

  const isNarrow = bodyWidth <= PANEL_NARROW_THRESHOLD
  // When narrow: show content if sidebar is closed. When wide: always show content.
  const showContent = !isNarrow || !isSideNavOpen

  const contextMenuAsset = contextMenuAssetId ? assets.find(a => a.id === contextMenuAssetId) : null
  const lastOpenedFolder = lastOpenedFolderId ? topLevelFolders.find(f => f.id === lastOpenedFolderId) : null
  const lastOpenedFolderDisplayName = lastOpenedFolder 
    ? (lastOpenedFolder.name === 'Sprites' ? 'Interior Props' : lastOpenedFolder.name)
    : null

  const contextMenuItems: MenuItem[] = contextMenuAsset ? [
    {
      label: 'Rename',
      onClick: () => {
        if (contextMenuAssetId) {
          handleRenameAsset(contextMenuAssetId)
        }
      },
      shortcut: '↵',
    },
    {
      label: 'Move',
      onClick: () => {
        if (contextMenuAssetId) {
          setMoveDialogAssetId(contextMenuAssetId)
          setShowMoveDialog(true)
        }
      },
    },
    ...(lastOpenedFolderDisplayName && lastOpenedFolderId ? [{
      label: `Move to ${lastOpenedFolderDisplayName}`,
      onClick: () => {
        if (contextMenuAssetId && lastOpenedFolderId) {
          moveAssetToFolder(contextMenuAssetId, lastOpenedFolderId)
        }
      },
    }] : []),
    { divider: true },
    {
      label: 'Create Folder',
      onClick: () => {
        const folderId = createFolder('New Folder')
        setLastOpenedFolderId(folderId)
        selectAsset(folderId)
        // Delay rename to ensure folder is selected first
        setTimeout(() => handleRenameAsset(folderId), 0)
      },
    },
    { divider: true },
    {
      label: 'Insert Asset',
      submenu: [
        {
          label: 'Insert',
          onClick: () => {
            console.log('Insert asset', contextMenuAssetId)
          },
        },
        {
          label: 'Insert with Location',
          onClick: () => {
            console.log('Insert with location', contextMenuAssetId)
          },
        },
      ],
    },
    {
      label: 'Edit Asset',
      onClick: () => {
        // TODO: Implement edit asset functionality
        console.log('Edit asset', contextMenuAssetId)
      },
    },
    {
      label: 'Share Asset',
      onClick: () => {
        // TODO: Implement share asset functionality
        console.log('Share asset', contextMenuAssetId)
      },
    },
    { divider: true },
    {
      label: 'Replace selected in workspace',
      onClick: () => {
        // TODO: Implement replace selected functionality
        console.log('Replace selected in workspace', contextMenuAssetId)
      },
    },
    {
      label: 'See references',
      onClick: () => {
        // TODO: Implement see references functionality
        console.log('See references', contextMenuAssetId)
      },
    },
    { divider: true },
    {
      label: 'Copy Asset ID',
      onClick: () => {
        // TODO: Implement copy asset ID functionality
        if (contextMenuAsset?.assetId) {
          navigator.clipboard.writeText(contextMenuAsset.assetId)
          console.log('Copied asset ID:', contextMenuAsset.assetId)
        }
      },
    },
    { divider: true },
    {
      label: 'View in Browser',
      onClick: () => {
        // TODO: Implement view in browser functionality
        console.log('View in browser', contextMenuAssetId)
      },
    },
  ] : []

  return (
    <DockablePanel widgetId="assets" title="Asset Manager">
      <div ref={bodyRef} className={styles.body}>
        {isSideNavOpen && (
        <div
          className={styles.sideNavWrap}
          style={
            showContent
              ? { width: sideNavWidth, minWidth: sideNavWidth }
              : { flex: 1, minWidth: 0 }
          }
        >
          <div className={styles.sideNavSearch}>
            <IconButton 
              icon={<img src={sidebarIconSvg} alt="Toggle Sidebar" width={16} height={16} />}
              size="xs" 
              tooltip="Toggle Sidebar" 
              onClick={() => setIsSideNavOpen(!isSideNavOpen)}
            />
            <div className={styles.sideNavSearchContainer}>
              <img src={searchIconImg} alt="Search" className={styles.sideNavSearchIcon} width={16} height={16} />
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchDialogOpen}
                onBlur={(e) => {
                  // Don't close if clicking within the search dialog
                  if (!e.relatedTarget?.closest) {
                    return
                  }
                }}
                className={styles.sideNavSearchInput}
                aria-label="Search"
              />
              {searchQuery && (
                <button
                  type="button"
                  className={styles.sideNavSearchClear}
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          {isSearchDialogOpen ? (
            <AssetSearchDialog
              isOpen={isSearchDialogOpen}
              onClose={handleSearchDialogClose}
              onSearch={handleSearchDialogSearch}
              selectedInventory={searchDialogInventory}
              selectedAssetType={searchDialogAssetType}
            />
          ) : (
            <nav className={styles.sideNav} aria-label="Asset categories">
              <div className={styles.sideNavTree}>
                <div>
                  <div
                    className={`${styles.sideNavRow} ${styles.sideNavRowProject}`}
                    style={{ paddingLeft: '8px' }}
                    onClick={() => setProjectExpanded(!projectExpanded)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setProjectExpanded((p) => !p)}
                  >
                    <span className={styles.sideNavExpand} aria-hidden={false}>
                      {projectExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
                    </span>
                    <span className={styles.sideNavIcon} aria-hidden />
                    <span className={styles.sideNavName}>Project</span>
                  </div>
                {projectExpanded && (
                  <>
                    <div
                      className={`${styles.sideNavRow} ${selectedNavId === 'recent' ? styles.sideNavRowSelected : ''}`}
                      style={{ paddingLeft: '24px' }}
                      onClick={() => navigateToFolder('recent')}
                      onDoubleClick={() => { if (isNarrow) setIsSideNavOpen(false) }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigateToFolder('recent')}
                    >
                      <span className={styles.sideNavExpand} aria-hidden>
                        {null}
                      </span>
                      <span className={styles.sideNavIcon}>
                        <img src="/icons/recently-imported.svg" alt="Import Queue" width={16} height={16} />
                      </span>
                      <span className={styles.sideNavName}>Import Queue</span>
                    </div>
                    <div>
                      <div
                        className={`${styles.sideNavRow} ${styles.sideNavRowWithChevron} ${selectedNavId === 'import-queue' ? styles.sideNavRowSelected : ''}`}
                        style={{ paddingLeft: '24px' }}
                        onClick={() => navigateToFolder('import-queue')}
                        onDoubleClick={() => { if (isNarrow) setIsSideNavOpen(false) }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigateToFolder('import-queue')}
                      >
                        <span
                          className={styles.sideNavExpand}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCrossyFarmExpanded(!crossyFarmExpanded)
                          }}
                          role="button"
                          aria-hidden={false}
                        >
                          {crossyFarmExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
                        </span>
                        <span className={styles.sideNavIcon}>
                          <img src="/icons/experience-folder.svg" alt="Crossy Farm" width={16} height={16} />
                        </span>
                        <span className={styles.sideNavName}>Crossy Farm</span>
                      </div>
                      {crossyFarmExpanded &&
                        topLevelFolders.map((folder) => {
                          const displayName = folder.name === 'Sprites' ? 'Interior Props' : folder.name
                          return (
                            <div
                              key={folder.id}
                              className={`${styles.sideNavRow} ${styles.sideNavRowWithChevron} ${selectedNavId === folder.id ? styles.sideNavRowSelected : ''}`}
                              style={{ paddingLeft: '40px' }}
                              onClick={() => {
                                navigateToFolder(folder.id)
                                setLastOpenedFolderId(folder.id)
                              }}
                              onDoubleClick={() => { if (isNarrow) setIsSideNavOpen(false) }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  navigateToFolder(folder.id)
                                  setLastOpenedFolderId(folder.id)
                                }
                              }}
                            >
                              <span className={styles.sideNavExpand} aria-hidden={false}>
                                <ExpandRightIcon />
                              </span>
                              <span className={styles.sideNavIcon}>
                                <img src="/icons/folder.svg" alt="" width={16} height={16} />
                              </span>
                              <span className={styles.sideNavName}>{displayName}</span>
                            </div>
                          )
                        })}
                    </div>
                  </>
                )}
              </div>
              <div>
                <div
                  className={`${styles.sideNavRow} ${styles.sideNavRowProject}`}
                  style={{ paddingLeft: '8px' }}
                  onClick={() => setInventoriesExpanded(!inventoriesExpanded)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setInventoriesExpanded((i) => !i)}
                >
                  <span className={styles.sideNavExpand} aria-hidden={false}>
                    {inventoriesExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />}
                  </span>
                  <span className={styles.sideNavIcon} aria-hidden />
                  <span className={styles.sideNavName}>Inventories</span>
                </div>
                {inventoriesExpanded && (
                  <>
                    <div
                      className={`${styles.sideNavRow} ${selectedNavId === EHOPE_NAV_ID ? styles.sideNavRowSelected : ''}`}
                      style={{ paddingLeft: '24px' }}
                      onClick={() => navigateToFolder(EHOPE_NAV_ID)}
                      onDoubleClick={() => { if (isNarrow) setIsSideNavOpen(false) }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigateToFolder(EHOPE_NAV_ID)}
                    >
                      <span className={styles.sideNavExpand} aria-hidden={false}>
                        <ExpandRightIcon />
                      </span>
                      <span className={styles.sideNavIcon}>
                        <img src="/icons/inventory.svg" alt="Inventory" width={16} height={16} />
                      </span>
                      <span className={styles.sideNavName}>ehopehopehope</span>
                    </div>
                    <div
                      className={`${styles.sideNavRow} ${selectedNavId === ALPHA_STRIKE_NAV_ID ? styles.sideNavRowSelected : ''}`}
                      style={{ paddingLeft: '24px' }}
                      onClick={() => navigateToFolder(ALPHA_STRIKE_NAV_ID)}
                      onDoubleClick={() => { if (isNarrow) setIsSideNavOpen(false) }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigateToFolder(ALPHA_STRIKE_NAV_ID)}
                    >
                      <span className={styles.sideNavExpand} aria-hidden={false}>
                        <ExpandRightIcon />
                      </span>
                      <span className={styles.sideNavIcon}>
                        <img src="/icons/group-inventory.svg" alt="Group Inventory" width={16} height={16} />
                      </span>
                      <span className={styles.sideNavName}>alpha strike</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </nav>
          )}
        </div>
        )}
        {showContent && (
          <div
            role="separator"
            aria-orientation="vertical"
            className={styles.sideNavResizeHandle}
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
          />
        )}
        {showContent && (
        <div className={styles.content}>
          {!isSearchDialogOpen && (<>
            <div className={styles.contentRow}>
              <div className={styles.contentRowChevrons}>
                {!isSideNavOpen && (
                  <IconButton 
                    icon={<img src={sidebarIconSvg} alt="Toggle Sidebar" width={16} height={16} />}
                    size="xs" 
                    tooltip="Toggle Sidebar" 
                    onClick={() => setIsSideNavOpen(!isSideNavOpen)}
                  />
                )}
                <IconButton 
                  icon={<ChevronLeft size={16} />} 
                  size="xs" 
                  tooltip="Back" 
                  onClick={goBack}
                  disabled={!canGoBack}
                />
                <IconButton 
                  icon={<ChevronRight size={16} />} 
                  size="xs" 
                  tooltip="Forward" 
                  onClick={goForward}
                  disabled={!canGoForward}
                />
              </div>
            {isImportQueueView ? (
              <>
                <div className={styles.queueLeftActions}>
                  <input
                    ref={queueFileInputRef}
                    type="file"
                    multiple
                    accept={IMPORT_ACCEPT}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : []
                      if (files.length) addToImportQueue(files)
                      e.target.value = ''
                    }}
                  />
                  <IconButton 
                    icon={<img src="/icons/Open.svg" alt="Open" width={16} height={16} />} 
                    size="sm" 
                    tooltip="Open" 
                    onClick={() => queueFileInputRef.current?.click()}
                  />
                  <IconButton 
                    icon={<img src="/icons/Cleanup.svg" alt="Cleanup" width={16} height={16} />} 
                    size="sm" 
                    tooltip="Clear Queue" 
                    onClick={clearImportQueue}
                  />
                </div>
                <div className={styles.queueSearchContainer}>
                  <img src={searchIconImg} alt="Search" className={styles.queueSearchIcon} width={16} height={16} />
                  <input
                    type="text"
                    placeholder="Search queue"
                    value={queueSearchQuery}
                    onChange={(e) => setQueueSearchQuery(e.target.value)}
                    className={styles.queueSearchInput}
                    aria-label="Search import queue"
                  />
                  {queueSearchQuery && (
                    <button
                      type="button"
                      className={styles.queueSearchClear}
                      onClick={() => setQueueSearchQuery('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className={styles.contentRowSpacer} aria-hidden />
            )}
            <div className={styles.contentRowActions}>
              {!isImportQueueView && (
                <>
                  <IconButton icon={<img src="/icons/refresh.svg" alt="Import Asset" width={16} height={16} />} size="xs" tooltip="Import Asset" />
                  <IconButton
                    ref={filterButtonRef}
                    icon={<img src="/icons/filter.svg" alt="Filter" width={16} height={16} />}
                    size="xs"
                    tooltip="Filter"
                    onClick={handleFilterClick}
                    active={isFilterMenuOpen}
                  />
                  <IconButton
                    icon={
                      assetViewMode === 'grid' ? (
                        <img src="/icons/grid-view.svg" alt="Grid view" width={16} height={16} />
                      ) : (
                        <img src="/icons/list-view.svg" alt="List view" width={16} height={16} />
                      )
                    }
                    size="xs"
                    tooltip={assetViewMode === 'grid' ? 'Grid view' : 'List view'}
                    onClick={() => setAssetViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
                  />
                  <div className={styles.contentRowSeparator} aria-hidden />
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={IMPORT_ACCEPT}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : []
                  if (files.length) {
                    addToImportQueue(files)
                    // Auto-process after adding to queue
                    setTimeout(() => processImportQueue(), 100)
                  }
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                className={styles.importButton}
                title={isImportQueueView ? "Import" : "Upload"}
                aria-label={isImportQueueView ? "Import" : "Upload"}
                onClick={() => {
                  if (isImportQueueView) {
                    processImportQueue()
                  } else {
                    fileInputRef.current?.click()
                  }
                }}
              >
                <span>{isImportQueueView ? "Import" : "Upload"}</span>
              </button>
            </div>
          </div>
          <div className={styles.contentScroll}>
            {isImportQueueView ? (
              <div className={styles.contentTableWrap}>
                <table ref={queueTableRef} className={styles.contentTable}>
                  <colgroup>
                    <col style={{ width: `calc((100% - 72px) * ${importQueueColPcts[0]} / 100)` }} />
                    <col style={{ width: `calc((100% - 72px) * ${importQueueColPcts[1]} / 100)` }} />
                    <col style={{ width: `calc((100% - 72px) * ${importQueueColPcts[2]} / 100)` }} />
                    <col style={{ width: `calc((100% - 72px) * ${importQueueColPcts[3]} / 100)` }} />
                    <col style={{ width: `calc((100% - 72px) * ${importQueueColPcts[4]} / 100)` }} />
                    <col className={styles.contentTableColStatus} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={`${styles.contentTableTh} ${styles.contentTableThCheckbox}`} aria-hidden="true">
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onQueueColResizeStart(0, e)}
                        />
                      </th>
                      <th className={`${styles.contentTableTh} ${styles.contentTableThQueue}`}>
                        Asset
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onQueueColResizeStart(1, e)}
                        />
                      </th>
                      <th className={styles.contentTableTh}>
                        Creator
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onQueueColResizeStart(2, e)}
                        />
                      </th>
                      <th className={styles.contentTableTh}>
                        Import Preset
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onQueueColResizeStart(3, e)}
                        />
                      </th>
                      <th className={`${styles.contentTableTh} ${styles.contentTableThFilePath}`}>
                        File Path
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onQueueColResizeStart(4, e)}
                        />
                      </th>
                      <th className={`${styles.contentTableTh} ${styles.contentTableThStatus}`}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.contentTableEmpty}>
                        </td>
                      </tr>
                    ) : (
                      importQueue.map((item) => {
                        const icon = assetIcons[item.assetType]
                        const statusClass = item.status === 'success' ? styles.statusSuccess : item.status === 'error' ? styles.statusError : item.status === 'importing' ? styles.statusImporting : styles.statusPending
                        return (
                          <tr key={item.id} className={styles.contentTableRow}>
                            <td className={`${styles.contentTableTd} ${styles.contentTableTdCheckbox}`}>
                              <img src="/icons/checkbox-on.svg" alt="Selected" width={14} height={14} className={styles.tableCheckboxIcon} />
                            </td>
                            <td className={styles.contentTableTd}>
                              <span className={styles.contentTableAssetIcon}>{icon}</span>
                              <span>{item.fileName}</span>
                            </td>
                            <td className={styles.contentTableTd}>
                              <div style={{ position: 'relative' }}>
                                <button
                                  className={styles.importPresetSelect}
                                  onClick={() => setOpenCreatorDropdown(openCreatorDropdown === item.id ? null : item.id)}
                                >
                                  <span>{item.creator}</span>
                                  <ExpandDownIcon />
                                </button>
                                <MenuDropdown
                                  items={[
                                    { label: 'ehopehopehope', onClick: () => updateImportQueueItem(item.id, { creator: 'ehopehopehope' }) },
                                    { label: 'alpha strike', onClick: () => updateImportQueueItem(item.id, { creator: 'alpha strike' }) },
                                  ]}
                                  isOpen={openCreatorDropdown === item.id}
                                  onClose={() => setOpenCreatorDropdown(null)}
                                />
                              </div>
                            </td>
                            <td className={styles.contentTableTd}>
                              <div style={{ position: 'relative' }}>
                                <button
                                  className={styles.importPresetSelect}
                                  onClick={() => setOpenPresetDropdown(openPresetDropdown === item.id ? null : item.id)}
                                >
                                  <span>{item.importPreset}</span>
                                  <ExpandDownIcon />
                                </button>
                                <MenuDropdown
                                  items={[
                                    { label: 'Default', onClick: () => updateImportQueueItem(item.id, { importPreset: 'Default' }) },
                                    { label: 'High Quality', onClick: () => updateImportQueueItem(item.id, { importPreset: 'High Quality' }) },
                                    { label: 'Optimized', onClick: () => updateImportQueueItem(item.id, { importPreset: 'Optimized' }) },
                                  ]}
                                  isOpen={openPresetDropdown === item.id}
                                  onClose={() => setOpenPresetDropdown(null)}
                                />
                              </div>
                            </td>
                            <td className={`${styles.contentTableTd} ${styles.contentTableTdFilePath}`} title={item.filePath}>
                              {item.filePath.length > 50 ? `...${item.filePath.slice(-47)}` : item.filePath}
                            </td>
                            <td className={`${styles.contentTableTd} ${styles.contentTableTdStatus} ${statusClass}`}>
                              {item.status === 'importing' && (
                                <img src={`/icons/ProgressCircle-${progressFrame}.svg`} alt="Importing" width={16} height={16} className={styles.progressCircle} />
                              )}
                              {item.status === 'success' && (
                                <img src="/icons/success.svg" alt="Success" width={16} height={16} />
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : assetViewMode === 'list' ? (
              <div className={styles.contentTableWrap}>
                <table ref={assetListTableRef} className={styles.contentTable}>
                  <colgroup>
                    <col style={{ width: `${assetListColPcts[0]}%` }} />
                    <col style={{ width: `${assetListColPcts[1]}%` }} />
                    <col style={{ width: `${assetListColPcts[2]}%` }} />
                    <col style={{ width: `${assetListColPcts[3]}%` }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className={styles.contentTableTh}>
                        <span className={styles.contentTableThDropdown}>
                          Name
                          <ChevronDown size={12} className={styles.contentTableThDropdownIcon} />
                        </span>
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onAssetListColResizeStart(0, e)}
                        />
                      </th>
                      <th className={styles.contentTableTh}>
                        ID
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onAssetListColResizeStart(1, e)}
                        />
                      </th>
                      <th className={styles.contentTableTh}>
                        Type
                        <span
                          role="separator"
                          aria-orientation="vertical"
                          className={styles.contentTableThResizeHandle}
                          onPointerDown={(e) => onAssetListColResizeStart(2, e)}
                        />
                      </th>
                      <th className={styles.contentTableTh}>
                        Date Modified
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assetsForGrid.length === 0 ? (
                      <tr>
                        <td colSpan={4} className={styles.contentTableEmpty}>
                          No assets
                        </td>
                      </tr>
                    ) : (
                      assetsForGrid.map((asset) => {
                        const icon = asset.type === 'folder' ? <img src="/icons/folder.svg" alt="" width={16} height={16} /> : assetIcons[asset.type]
                        const displayName = asset.name === 'Sprites' ? 'Interior Props' : asset.name
                        const isFolder = asset.type === 'folder'
                        const previewImageUrl =
                          asset.type === 'texture' || asset.type === 'material'
                            ? (asset.thumbnail ?? asset.path)
                            : ''
                        const modelPath = asset.type === 'model' ? asset.path : undefined
                        const isSelected = selectedAssetIds.includes(asset.id)
                        const isDragOver = dragOverFolderId === asset.id
                        return (
                          <tr
                            key={asset.id}
                            className={`${styles.contentTableRow} ${isSelected ? styles.contentTableRowSelected : ''} ${isDragOver ? styles.dragOver : ''}`}
                            draggable={renamingAssetId !== asset.id}
                            onClick={(e) => selectAsset(asset.id, { range: e.shiftKey, additive: e.metaKey || e.ctrlKey, visibleAssetIds })}
                            onDoubleClick={isFolder ? () => navigateToFolder(asset.id) : undefined}
                            onContextMenu={(e) => handleAssetContextMenu(asset.id, e)}
                            onMouseDown={(e) => {
                              // Handle control+click as context menu
                              if (e.ctrlKey && e.button === 0) {
                                handleAssetContextMenu(asset.id, e)
                              }
                            }}
                            onDragStart={(e) => {
                              if (renamingAssetId !== asset.id) {
                                handleDragStart(asset.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', displayName)
                              }
                            }}
                            onDragOver={(e) => {
                              if (isFolder) {
                                handleDragOver(e, asset.id)
                              }
                            }}
                            onDragLeave={() => {
                              if (isFolder) {
                                handleDragLeave()
                              }
                            }}
                            onDrop={(e) => {
                              if (isFolder) {
                                handleDrop(e, asset.id)
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                selectAsset(asset.id)
                              }
                            }}
                            aria-pressed={isSelected}
                          >
                            <td className={styles.contentTableTd}>
                              <AssetTile
                                id={asset.id}
                                name={displayName}
                                typeLabel={getTypeLabel(asset)}
                                icon={icon}
                                previewImageUrl={previewImageUrl}
                                modelPath={modelPath}
                                isSelected={isSelected}
                                onSelect={() => {}}
                                onContextMenu={(e) => {
                                  e.stopPropagation()
                                  handleAssetContextMenu(asset.id, e)
                                }}
                                viewMode="list"
                                isRenaming={renamingAssetId === asset.id}
                                onRename={(newName) => handleConfirmRename(asset.id, newName)}
                                onCancelRename={handleCancelRename}
                                isFolder={isFolder}
                                isDragOver={isDragOver}
                              />
                            </td>
                            <td className={styles.contentTableTd}>{isFolder ? '—' : asset.assetId}</td>
                            <td className={styles.contentTableTd}>{getTypeLabel(asset)}</td>
                            <td className={styles.contentTableTd}>{asset.dateModified || '—'}</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className={styles.gridView}>
                {assetsForGrid.length === 0 ? (
                  <div className={styles.contentTableEmpty}>No assets</div>
                ) : (
                  assetsForGrid.map((asset) => {
                    const icon = asset.type === 'folder' ? <img src="/icons/folder.svg" alt="" width={16} height={16} /> : assetIcons[asset.type]
                    const displayName = asset.name === 'Sprites' ? 'Interior Props' : asset.name
                    const previewImageUrl =
                      asset.type === 'texture' || asset.type === 'material'
                        ? (asset.thumbnail ?? asset.path)
                        : ''
                    // Only pass modelPath for visible assets to reduce rendering load
                    const modelPath = asset.type === 'model' ? asset.path : undefined
                    const handleDoubleClick = asset.type === 'folder' ? () => navigateToFolder(asset.id) : undefined
                    const isSelected = selectedAssetIds.includes(asset.id)
                    const isFolder = asset.type === 'folder'
                    const isDragOver = dragOverFolderId === asset.id
                    return (
                      <AssetTile
                        key={asset.id}
                        id={asset.id}
                        name={displayName}
                        typeLabel={getTypeLabel(asset)}
                        icon={icon}
                        previewImageUrl={previewImageUrl}
                        modelPath={modelPath}
                        isSelected={isSelected}
                        onSelect={(e) => selectAsset(asset.id, { range: e?.shiftKey, additive: e?.metaKey || e?.ctrlKey, visibleAssetIds })}
                        onDoubleClick={handleDoubleClick}
                        onContextMenu={(e) => handleAssetContextMenu(asset.id, e)}
                        isRenaming={renamingAssetId === asset.id}
                        onRename={(newName) => handleConfirmRename(asset.id, newName)}
                        onCancelRename={handleCancelRename}
                        isFolder={isFolder}
                        isDragOver={isDragOver}
                        onDragStart={() => handleDragStart(asset.id)}
                        onDragOver={(e) => handleDragOver(e, asset.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, asset.id)}
                      />
                    )
                  })
                )}
              </div>
            )}
          </div>
          </>)}
        </div>
        )}
      </div>
      
      <ContextMenu
        items={contextMenuItems}
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
      />
      
      <MoveDialog
        isOpen={showMoveDialog}
        assetCount={selectedAssetIds.length}
        folders={topLevelFolders}
        onMove={(targetFolderId) => {
          selectedAssetIds.forEach(assetId => {
            moveAssetToFolder(assetId, targetFolderId)
          })
          setShowMoveDialog(false)
          setMoveDialogAssetId(null)
        }}
        onCancel={() => {
          setShowMoveDialog(false)
          setMoveDialogAssetId(null)
        }}
      />

      <FilterMenu
        isOpen={isFilterMenuOpen}
        onClose={() => setIsFilterMenuOpen(false)}
        position={filterMenuPosition}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />
    </DockablePanel>
  )
}




