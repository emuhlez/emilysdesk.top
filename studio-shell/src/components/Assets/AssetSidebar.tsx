import { useState, useCallback, useRef, memo } from 'react'
import { X } from 'lucide-react'
import { ExpandDownIcon, ExpandRightIcon } from '../shared/ExpandIcons'
import searchIconImg from '../../../images/search.png'
import type { Asset } from '../../types'
import styles from './Assets.module.css'

const SIDE_NAV_MIN = 220
const SIDE_NAV_MAX = 400
const SIDE_NAV_DEFAULT = 220

interface AssetSidebarProps {
  topLevelFolders: Asset[]
  selectedNavId: string | null
  onSelectNavId: (id: string | null) => void
  onFolderOpen?: (folderId: string) => void
}

/**
 * Asset sidebar with navigation tree and search
 * Extracted for better modularity and performance
 */
export const AssetSidebar = memo(function AssetSidebar({
  topLevelFolders,
  selectedNavId,
  onSelectNavId,
  onFolderOpen,
}: AssetSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [projectExpanded, setProjectExpanded] = useState(true)
  const [crossyFarmExpanded, setCrossyFarmExpanded] = useState(true)
  const [inventoriesExpanded, setInventoriesExpanded] = useState(true)
  const [sideNavWidth, setSideNavWidth] = useState(SIDE_NAV_DEFAULT)
  const resizeStartRef = useRef({ x: 0, w: 0 })

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

  return (
    <div className={styles.sideNavWrap} style={{ width: sideNavWidth, minWidth: sideNavWidth }}>
      <div className={styles.sideNavSearch}>
        <div className={styles.sideNavSearchContainer}>
          <img src={searchIconImg} alt="Search" className={styles.sideNavSearchIcon} width={16} height={16} />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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
                  onClick={() => onSelectNavId('recent')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && onSelectNavId('recent')}
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
                    onClick={() => onSelectNavId('import-queue')}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && onSelectNavId('import-queue')}
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
                            onSelectNavId(folder.id)
                            onFolderOpen?.(folder.id)
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onSelectNavId(folder.id)
                              onFolderOpen?.(folder.id)
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
            {inventoriesExpanded && null}
          </div>
        </div>
      </nav>
      <div
        role="separator"
        aria-orientation="vertical"
        className={styles.sideNavResizeHandle}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
      />
    </div>
  )
})
