import { useRef, useState, memo } from 'react'
import { IconButton } from '../shared/IconButton'
import { FilterMenu, type ActiveFilters } from './FilterMenu'
import styles from './Assets.module.css'

interface AssetToolbarProps {
  assetViewMode: 'grid' | 'list'
  onViewModeChange: (mode: 'grid' | 'list') => void
  onImport: (files: File[]) => void
}

const IMPORT_ACCEPT = '.gltf,.glb,.fbx,.obj,.dae,.mp3,.mp4,.m4a,.wav,.ogg,.aac,.flac,.mov,.webm,.avi,.mkv,.png,.jpg,.jpeg,.webp,.tga,.tif,.tiff,.bmp,.js,.ts,.cjs,.mjs,.mat,.prefab,.scene'

/**
 * Asset toolbar with view controls and import button
 * Memoized to prevent unnecessary re-renders
 */
export const AssetToolbar = memo(function AssetToolbar({
  assetViewMode,
  onViewModeChange,
  onImport,
}: AssetToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false)
  const [filterMenuPosition, setFilterMenuPosition] = useState({ top: 0, right: 0 })
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({
    assetTypes: new Set(),
    sources: new Set(),
    creators: new Set(),
  })

  const handleFilterClick = () => {
    if (filterButtonRef.current) {
      const rect = filterButtonRef.current.getBoundingClientRect()
      setFilterMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
    setIsFilterMenuOpen(!isFilterMenuOpen)
  }

  return (
    <div className={styles.contentRow}>
      <div className={styles.contentRowSpacer} aria-hidden />
      <div className={styles.contentRowActions}>
        <IconButton 
          icon={<img src="/icons/refresh.svg" alt="Import Asset" width={16} height={16} />} 
          size="xs" 
          tooltip="Import Asset" 
        />
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
          onClick={() => onViewModeChange(assetViewMode === 'grid' ? 'list' : 'grid')}
        />
        <div className={styles.contentRowSeparator} aria-hidden />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={IMPORT_ACCEPT}
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : []
            if (files.length) {
              onImport(files)
            }
            e.target.value = ''
          }}
        />
        <button
          type="button"
          className={styles.importButton}
          title="Import"
          aria-label="Import"
          onClick={() => fileInputRef.current?.click()}
        >
          <span>Import</span>
        </button>
      </div>
      <FilterMenu
        isOpen={isFilterMenuOpen}
        onClose={() => setIsFilterMenuOpen(false)}
        position={filterMenuPosition}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
      />
    </div>
  )
})
