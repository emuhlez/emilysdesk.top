import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Folder,
  Image,
  FileCode,
  Volume2,
  Box,
  Layers,
  Film,
  Video,
  ChevronDown,
} from 'lucide-react'

import { DockablePanel } from '../shared/DockablePanel'
import { ContextMenu, useContextMenu } from '../shared/ContextMenu'
import type { MenuItem } from '../shared/MenuDropdown'
import { useAssetStore } from '../../store/assetStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useEditorStore } from '../../store/editorStore'
import type { Asset } from '../../types'
import { AssetTile } from './AssetTile'
import { MoveDialog } from './MoveDialog'
import { AssetSidebar } from './AssetSidebar'
import { AssetToolbar } from './AssetToolbar'
import { useDragAndDrop } from '../../hooks/useDragAndDrop'
import styles from './Assets.module.css'

const assetIcons: Record<Asset['type'], React.ReactNode> = {
  folder: <Folder size={14} />,
  texture: <Image size={14} />,
  model: <Box size={14} />,
  audio: <Volume2 size={14} />,
  video: <Video size={14} />,
  script: <FileCode size={14} />,
  material: <Layers size={14} />,
  prefab: <Box size={14} />,
  scene: <Film size={14} />,
  animation: <img src="/icons/animation.svg" alt="Animation" width={14} height={14} />,
}

/**
 * Refactored Assets component with improved modularity and performance
 * - Uses separate stores for assets and selection
 * - Extracted sidebar, toolbar into separate components
 * - Uses custom hook for drag & drop
 * - Memoized calculations to prevent unnecessary re-renders
 */
export function Assets() {
  // Store subscriptions - selective to prevent unnecessary re-renders
  const assets = useAssetStore((state) => state.assets)
  const importAssets = useAssetStore((state) => state.importAssets)
  const renameAsset = useAssetStore((state) => state.renameAsset)
  const createFolder = useAssetStore((state) => state.createFolder)
  const moveAssetToFolder = useAssetStore((state) => state.moveAssetToFolder)
  
  const selectedAssetIds = useSelectionStore((state) => state.selectedAssetIds)
  const selectAsset = useSelectionStore((state) => state.selectAsset)
  
  const log = useEditorStore((state) => state.log)
  
  // Local UI state
  const [selectedNavId, setSelectedNavId] = useState<string | null>(null)
  const [assetViewMode, setAssetViewMode] = useState<'grid' | 'list'>('grid')
  const [lastOpenedFolderId, setLastOpenedFolderId] = useState<string | null>(null)
  const [renamingAssetId, setRenamingAssetId] = useState<string | null>(null)
  const [showMoveDialog, setShowMoveDialog] = useState(false)
  const contextMenu = useContextMenu()
  const [contextMenuAssetId, setContextMenuAssetId] = useState<string | null>(null)

  // Drag and drop hook
  const dragAndDrop = useDragAndDrop({
    onDragStart: (id) => {
      // If dragging an unselected asset, select only that asset
      if (!selectedAssetIds.includes(id)) {
        selectAsset(id, { additive: false, range: false })
      }
    },
    onDrop: (_draggedId, targetId) => {
      // Move all selected assets to the target folder
      selectedAssetIds.forEach(assetId => {
        if (assetId !== targetId) {
          moveAssetToFolder(assetId, targetId)
        }
      })
      log(`Moved ${selectedAssetIds.length} asset(s)`, 'info')
    },
    canDrop: (_draggedId, targetId) => {
      // Only allow dropping on folders
      const targetAsset = assets.find(a => a.id === targetId) || 
                          assets.flatMap(a => a.children || []).find(c => c.id === targetId)
      return targetAsset?.type === 'folder'
    },
  })

  // Memoize top-level folders to avoid recalculation
  const topLevelFolders = useMemo(
    () => assets.filter((a): a is Asset => a.type === 'folder'),
    [assets]
  )

  // Memoize displayed assets based on navigation selection
  const displayAssets = useMemo((): Asset[] => {
    if (selectedNavId === null) return assets
    
    const isSpecialNavId = selectedNavId === 'recent' || selectedNavId === 'import-queue' || 
                          selectedNavId === 'inventories' || selectedNavId === 'ehopehopehope'
    if (isSpecialNavId) return []
    
    const folder = topLevelFolders.find((f) => f.id === selectedNavId)
    return folder ? [folder] : assets
  }, [selectedNavId, assets, topLevelFolders])

  // Memoize assets for grid/list view
  const assetsForGrid = useMemo(() => {
    const result = (
      selectedNavId === 'import-queue'
        ? assets
        : displayAssets.length === 1 && displayAssets[0].type === 'folder'
          ? displayAssets[0].children ?? []
          : displayAssets
    )
    return result.sort((a, b) => a.name.localeCompare(b.name))
  }, [selectedNavId, displayAssets, assets])

  const isImportQueueView = selectedNavId === 'recent'

  const getTypeLabel = useCallback((a: Asset): string =>
    a.type === 'folder' ? 'Folder' : a.type.charAt(0).toUpperCase() + a.type.slice(1),
    []
  )

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

  const handleRenameAsset = useCallback((assetId: string) => {
    setRenamingAssetId(assetId)
  }, [])

  const handleConfirmRename = useCallback((assetId: string, newName: string) => {
    const asset = assets.find(a => a.id === assetId) || 
                  assets.flatMap(a => a.children || []).find(c => c.id === assetId)
    if (newName.trim() && asset && newName !== asset.name) {
      renameAsset(assetId, newName.trim())
      log(`Renamed asset to "${newName.trim()}"`, 'info')
    }
    setRenamingAssetId(null)
  }, [assets, renameAsset, log])

  const handleCancelRename = useCallback(() => {
    setRenamingAssetId(null)
  }, [])

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

  // Context menu items
  const contextMenuAsset = contextMenuAssetId ? 
    assets.find(a => a.id === contextMenuAssetId) || 
    assets.flatMap(a => a.children || []).find(c => c.id === contextMenuAssetId) : 
    null
    
  const lastOpenedFolder = lastOpenedFolderId ? topLevelFolders.find(f => f.id === lastOpenedFolderId) : null
  const lastOpenedFolderDisplayName = lastOpenedFolder 
    ? (lastOpenedFolder.name === 'Sprites' ? 'Interior Props' : lastOpenedFolder.name)
    : null

  const contextMenuItems: MenuItem[] = useMemo(() => contextMenuAsset ? [
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
          setShowMoveDialog(true)
        }
      },
    },
    ...(lastOpenedFolderDisplayName && lastOpenedFolderId ? [{
      label: `Move to ${lastOpenedFolderDisplayName}`,
      onClick: () => {
        if (contextMenuAssetId && lastOpenedFolderId) {
          moveAssetToFolder(contextMenuAssetId, lastOpenedFolderId)
          log(`Moved to ${lastOpenedFolderDisplayName}`, 'info')
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
        console.log('Edit asset', contextMenuAssetId)
      },
    },
    {
      label: 'Share Asset',
      onClick: () => {
        console.log('Share asset', contextMenuAssetId)
      },
    },
    { divider: true },
    {
      label: 'Replace selected in workspace',
      onClick: () => {
        console.log('Replace selected in workspace', contextMenuAssetId)
      },
    },
    {
      label: 'See references',
      onClick: () => {
        console.log('See references', contextMenuAssetId)
      },
    },
    { divider: true },
    {
      label: 'Copy Asset ID',
      onClick: () => {
        if (contextMenuAsset?.assetId) {
          navigator.clipboard.writeText(contextMenuAsset.assetId)
          log(`Copied asset ID: ${contextMenuAsset.assetId}`, 'info')
        }
      },
    },
    { divider: true },
    {
      label: 'View in Browser',
      onClick: () => {
        console.log('View in browser', contextMenuAssetId)
      },
    },
  ] : [], [
    contextMenuAsset,
    contextMenuAssetId,
    lastOpenedFolderDisplayName,
    lastOpenedFolderId,
    handleRenameAsset,
    moveAssetToFolder,
    createFolder,
    selectAsset,
    log,
  ])

  return (
    <DockablePanel widgetId="assets" title="Asset Manager">
      <div className={styles.body}>
        <AssetSidebar
          topLevelFolders={topLevelFolders}
          selectedNavId={selectedNavId}
          onSelectNavId={setSelectedNavId}
          onFolderOpen={setLastOpenedFolderId}
        />
        
        <div className={styles.content}>
          <AssetToolbar
            assetViewMode={assetViewMode}
            onViewModeChange={setAssetViewMode}
            onImport={importAssets}
          />
          
          <div className={styles.contentScroll}>
            {isImportQueueView ? (
              <div className={styles.contentTableWrap}>
                <table className={styles.contentTable}>
                  <thead>
                    <tr>
                      <th className={styles.contentTableTh}>
                        <span className={styles.contentTableThDropdown}>
                          Name
                          <ChevronDown size={12} className={styles.contentTableThDropdownIcon} />
                        </span>
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        ID
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        Creator
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        Import Preset
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        File Path
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayAssets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className={styles.contentTableEmpty}>
                          No assets
                        </td>
                      </tr>
                    ) : (
                      displayAssets.map((asset) => {
                        const isFolder = asset.type === 'folder'
                        const icon = isFolder ? <img src="/icons/folder.svg" alt="" width={16} height={16} /> : assetIcons[asset.type]
                        const displayName = asset.name === 'Sprites' ? 'Interior Props' : asset.name
                        return (
                          <tr key={asset.id} className={styles.contentTableRow}>
                            <td className={styles.contentTableTd}>
                              <span className={styles.contentTableAssetIcon}>{icon}</span>
                              <span>{displayName}</span>
                            </td>
                            <td className={styles.contentTableTd}>{isFolder ? '—' : asset.assetId}</td>
                            <td className={styles.contentTableTd}>—</td>
                            <td className={styles.contentTableTd}>—</td>
                            <td className={styles.contentTableTd}>—</td>
                            <td className={styles.contentTableTd}>—</td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            ) : assetViewMode === 'list' ? (
              <div className={styles.contentTableWrap}>
                <table className={styles.contentTable}>
                  <thead>
                    <tr>
                      <th className={styles.contentTableTh}>
                        <span className={styles.contentTableThDropdown}>
                          Name
                          <ChevronDown size={12} className={styles.contentTableThDropdownIcon} />
                        </span>
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        ID
                        <span className={styles.contentTableThDivider} aria-hidden />
                      </th>
                      <th className={styles.contentTableTh}>
                        Type
                        <span className={styles.contentTableThDivider} aria-hidden />
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
                        const isDragOver = dragAndDrop.dragOverId === asset.id
                        return (
                          <tr
                            key={asset.id}
                            className={`${styles.contentTableRow} ${isSelected ? styles.contentTableRowSelected : ''} ${isDragOver ? styles.dragOver : ''}`}
                            draggable={renamingAssetId !== asset.id}
                            onClick={(e) => selectAsset(asset.id, { range: e.shiftKey, additive: e.metaKey || e.ctrlKey })}
                            onDoubleClick={isFolder ? () => setSelectedNavId(asset.id) : undefined}
                            onContextMenu={(e) => handleAssetContextMenu(asset.id, e)}
                            onMouseDown={(e) => {
                              if (e.ctrlKey && e.button === 0) {
                                handleAssetContextMenu(asset.id, e)
                              }
                            }}
                            onDragStart={(e) => {
                              if (renamingAssetId !== asset.id) {
                                dragAndDrop.handleDragStart(asset.id)
                                e.dataTransfer.effectAllowed = 'move'
                                e.dataTransfer.setData('text/plain', displayName)
                              }
                            }}
                            onDragOver={(e) => {
                              if (isFolder) {
                                dragAndDrop.handleDragOver(e, asset.id)
                              }
                            }}
                            onDragLeave={() => {
                              if (isFolder) {
                                dragAndDrop.handleDragLeave()
                              }
                            }}
                            onDrop={(e) => {
                              if (isFolder) {
                                dragAndDrop.handleDrop(e, asset.id)
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
                    const modelPath = asset.type === 'model' ? asset.path : undefined
                    const handleDoubleClick = asset.type === 'folder' ? () => setSelectedNavId(asset.id) : undefined
                    const isSelected = selectedAssetIds.includes(asset.id)
                    const isFolder = asset.type === 'folder'
                    const isDragOver = dragAndDrop.dragOverId === asset.id
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
                        onSelect={(e) => selectAsset(asset.id, { range: e?.shiftKey, additive: e?.metaKey || e?.ctrlKey })}
                        onDoubleClick={handleDoubleClick}
                        onContextMenu={(e) => handleAssetContextMenu(asset.id, e)}
                        isRenaming={renamingAssetId === asset.id}
                        onRename={(newName) => handleConfirmRename(asset.id, newName)}
                        onCancelRename={handleCancelRename}
                        isFolder={isFolder}
                        isDragOver={isDragOver}
                        onDragStart={() => dragAndDrop.handleDragStart(asset.id)}
                        onDragOver={(e) => dragAndDrop.handleDragOver(e, asset.id)}
                        onDragLeave={dragAndDrop.handleDragLeave}
                        onDrop={(e) => dragAndDrop.handleDrop(e, asset.id)}
                      />
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
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
          log(`Moved ${selectedAssetIds.length} asset(s)`, 'info')
        }}
        onCancel={() => {
          setShowMoveDialog(false)
        }}
      />
    </DockablePanel>
  )
}
