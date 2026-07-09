import { useState, useRef, useEffect, memo, type ReactNode } from 'react'
import styles from './Assets.module.css'
import { ModelPreview } from './ModelPreview'

export interface AssetTileProps {
  id: string
  /** Display name (can differ from asset name, e.g. "Interior Props") */
  name: string
  /** Type label for sublabel (e.g. "Folder", "Texture") */
  typeLabel: string
  /** Icon shown in the preview area when no texture image or on image error */
  icon: ReactNode
  /** Image URL for texture assets – required for textures; shown in preview. Empty string for non-textures. */
  previewImageUrl: string
  /** Path to 3D model file for live preview */
  modelPath?: string
  isSelected: boolean
  onSelect: (e?: React.MouseEvent) => void
  onDoubleClick?: () => void
  onContextMenu?: (e: React.MouseEvent) => void
  /** View mode - 'grid' or 'list' */
  viewMode?: 'grid' | 'list'
  /** Whether this asset is being renamed */
  isRenaming?: boolean
  /** Callback when rename is confirmed */
  onRename?: (newName: string) => void
  /** Callback when rename is cancelled */
  onCancelRename?: () => void
  /** Whether this asset is a folder (droppable) */
  isFolder?: boolean
  /** Whether a drag is currently over this folder */
  isDragOver?: boolean
  /** Drag handlers */
  onDragStart?: () => void
  onDragOver?: (e: React.DragEvent) => void
  onDragLeave?: () => void
  onDrop?: (e: React.DragEvent) => void
}

const AssetTileComponent = ({ name, typeLabel, icon, previewImageUrl, modelPath, isSelected, onSelect, onDoubleClick, onContextMenu, viewMode = 'grid', isRenaming = false, onRename, onCancelRename, isFolder = false, isDragOver = false, onDragStart, onDragOver, onDragLeave, onDrop }: AssetTileProps) => {
  const [imageError, setImageError] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [renameValue, setRenameValue] = useState(name)
  const [isOverflowing, setIsOverflowing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)
  
  const showTexture = previewImageUrl.length > 0 && !imageError
  const hasModel = modelPath && modelPath.length > 0
  const isListMode = viewMode === 'list'

  // Check if label text is overflowing
  useEffect(() => {
    if (labelRef.current && !isRenaming) {
      const isOverflow = labelRef.current.scrollWidth > labelRef.current.clientWidth
      setIsOverflowing(isOverflow)
    }
  }, [name, isRenaming])

  // Focus input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  // Reset rename value when name changes or renaming ends
  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(name)
    }
  }, [name, isRenaming])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onRename?.(renameValue)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancelRename?.()
    }
  }

  const handleBlur = () => {
    if (isRenaming) {
      onRename?.(renameValue)
    }
  }

  return (
    <div
      className={`${styles.assetTile} ${isSelected ? styles.selected : ''} ${isListMode ? styles.assetTileList : ''} ${isDragOver ? styles.dragOver : ''}`}
      draggable={!isRenaming}
      onClick={(e) => !isRenaming && onSelect(e)}
      onDoubleClick={!isRenaming ? onDoubleClick : undefined}
      onContextMenu={!isRenaming ? onContextMenu : undefined}
      onMouseDown={(e) => {
        // Handle control+click as context menu
        if (!isRenaming && e.ctrlKey && e.button === 0 && onContextMenu) {
          onContextMenu(e)
        }
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onDragStart={(e) => {
        if (!isRenaming && onDragStart) {
          e.stopPropagation()
          onDragStart()
          // Set drag data
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', name)
          // Optional: Create custom drag image
          if (e.dataTransfer.setDragImage && e.currentTarget) {
            e.dataTransfer.setDragImage(e.currentTarget as HTMLElement, 50, 50)
          }
        } else if (isRenaming) {
          e.preventDefault()
        }
      }}
      onDragOver={(e) => {
        if (isFolder && onDragOver) {
          onDragOver(e)
        }
      }}
      onDragLeave={() => {
        if (isFolder && onDragLeave) {
          onDragLeave()
        }
      }}
      onDrop={(e) => {
        if (isFolder && onDrop) {
          onDrop(e)
        }
      }}
      role="button"
      tabIndex={isRenaming ? -1 : 0}
      onKeyDown={(e) => !isRenaming && e.key === 'Enter' && onSelect()}
    >
      <div className={`${styles.assetTilePreview} ${modelLoading ? styles.loading : ''} ${isListMode ? styles.assetTilePreviewList : ''}`}>
        {hasModel ? (
          <ModelPreview 
            modelPath={modelPath} 
            className={styles.assetTilePreviewTexture} 
            animate={isListMode ? false : isHovered}
            onLoadingChange={setModelLoading}
          />
        ) : showTexture ? (
          <img
            src={previewImageUrl}
            alt=""
            className={styles.assetTilePreviewTexture}
            onError={() => setImageError(true)}
          />
        ) : (
          icon
        )}
      </div>
      <div className={styles.assetTileInfo}>
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            className={styles.assetTileRenameInput}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span 
            ref={labelRef}
            className={`${styles.assetTileLabel} ${isOverflowing ? styles.assetTileLabelOverflowing : ''}`} 
            title={name}
          >
            {name}
          </span>
        )}
        {!isListMode && !isRenaming && <span className={styles.assetTileSublabel}>{typeLabel}</span>}
      </div>
    </div>
  )
}

// Memoize component to prevent unnecessary re-renders
export const AssetTile = memo(AssetTileComponent, (prevProps, nextProps) => {
  // Custom comparison for better performance
  return (
    prevProps.id === nextProps.id &&
    prevProps.name === nextProps.name &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isRenaming === nextProps.isRenaming &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.modelPath === nextProps.modelPath &&
    prevProps.previewImageUrl === nextProps.previewImageUrl &&
    prevProps.isDragOver === nextProps.isDragOver
  )
})
