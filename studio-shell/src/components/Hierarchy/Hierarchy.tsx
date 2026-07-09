import { useState, useEffect } from 'react'
import {
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Box,
  Image,
  Grid2X2,
  Sparkles,
  FileCode,
  Volume2,
  Layers
} from 'lucide-react'
import { DockablePanel } from '../shared/DockablePanel'
import { ExpandDownIcon, ExpandRightIcon } from '../shared/ExpandIcons'
import { IconButton } from '../shared/IconButton'
import { ContextMenu, useContextMenu } from '../shared/ContextMenu'
import type { MenuItem } from '../shared/MenuDropdown'
import { useEditorStore } from '../../store/editorStore'
import type { GameObjectType } from '../../types'
import styles from './Hierarchy.module.css'

const typeIcons: Record<GameObjectType, React.ReactNode> = {
  empty: <Layers size={16} />,
  mesh: <Box size={16} />,
  light: <img src="/icons/terrain.svg" alt="Light" width={16} height={16} />,
  camera: <img src="/icons/camera.svg" alt="Camera" width={16} height={16} />,
  audio: <Volume2 size={16} />,
  sprite: <Image size={16} />,
  tilemap: <Grid2X2 size={16} />,
  particle: <Sparkles size={16} />,
  script: <FileCode size={16} />,
}

function ReimportProgress({ isCompleting }: { isCompleting: boolean }) {
  const [frame, setFrame] = useState(1)
  const [startTime] = useState(Date.now())

  useEffect(() => {
    if (isCompleting) {
      // Show frame 4 (100% complete)
      setFrame(4)
      return
    }
    
    // Update frame based on elapsed time (linear progress)
    // Total duration: 2500ms
    // Frame 1: 0-833ms (0-33%)
    // Frame 2: 833-1666ms (33-66%)
    // Frame 3: 1666-2500ms (66-99%)
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      let newFrame: number
      
      if (elapsed < 833) {
        newFrame = 1
      } else if (elapsed < 1666) {
        newFrame = 2
      } else {
        newFrame = 3
      }
      
      if (newFrame !== frame) {
        setFrame(newFrame)
      }
    }, 100) // Check every 100ms

    return () => clearInterval(interval)
  }, [isCompleting, startTime, frame])

  return (
    <div className={styles.reimportProgress}>
      <img 
        src={`/icons/ProgressCircle-${frame}.svg`} 
        alt="Reimporting" 
        width={16} 
        height={16}
      />
    </div>
  )
}


interface TreeNodeProps {
  objectId: string
  depth: number
}

function TreeNode({ objectId, depth }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const { 
    gameObjects, 
    selectedObjectIds, 
    selectObject,
    updateGameObject,
    deleteGameObject,
    reimportGameObject,
    reimportingObjectIds,
    completingReimportIds
  } = useEditorStore()
  
  const contextMenu = useContextMenu()
  
  const obj = gameObjects[objectId]
  if (!obj) return null

  const hasChildren = obj.children.length > 0
  const isSelected = selectedObjectIds.includes(objectId)
  const isWorkspaceRoot = obj.parentId === null && obj.name === 'Workspace'
  const isReimporting = reimportingObjectIds.includes(objectId)
  const isCompleting = completingReimportIds.includes(objectId)
  const showProgress = isReimporting || isCompleting

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  const toggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateGameObject(objectId, { visible: !obj.visible })
  }

  const toggleLock = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateGameObject(objectId, { locked: !obj.locked })
  }

  // Context menu items
  const menuItems: MenuItem[] = [
    {
      label: 'Cut',
      onClick: () => console.log('Cut', objectId),
      shortcut: '⌘X',
    },
    {
      label: 'Copy',
      onClick: () => console.log('Copy', objectId),
      shortcut: '⌘C',
    },
    {
      label: 'Paste',
      onClick: () => console.log('Paste', objectId),
      shortcut: '⌘V',
    },
    {
      label: 'Duplicate',
      onClick: () => console.log('Duplicate', objectId),
      shortcut: '⌘D',
    },
    {
      label: 'Delete',
      onClick: () => deleteGameObject(objectId),
      shortcut: '⌫',
    },
    {
      label: 'Rename',
      onClick: () => console.log('Rename', objectId),
      shortcut: '↩︎',
    },
    { divider: true },
    {
      label: 'Group as Model',
      onClick: () => console.log('Group as Model', objectId),
      shortcut: '⌘G',
    },
    {
      label: 'Group as Folder',
      onClick: () => console.log('Group as Folder', objectId),
      shortcut: '⌃⌘G',
    },
    {
      label: 'Ungroup',
      onClick: () => console.log('Ungroup', objectId),
      shortcut: '⌘U',
    },
    { divider: true },
    {
      label: 'Insert',
      submenu: [
        { label: 'Object', onClick: () => console.log('Insert Object') },
        { label: 'Part', onClick: () => console.log('Insert Part') },
        { label: 'Service', onClick: () => console.log('Insert Service') },
      ],
    },
    {
      label: 'Hierarchy',
      submenu: [
        { label: 'Select Children', onClick: () => console.log('Select Children') },
        { label: 'Move to Parent', onClick: () => console.log('Move to Parent') },
        { label: 'Move to Workspace', onClick: () => console.log('Move to Workspace') },
      ],
    },
    {
      label: 'Zoom to',
      onClick: () => console.log('Zoom to', objectId),
      shortcut: 'F',
    },
    { divider: true },
    {
      label: 'Reimport',
      submenu: [
        { 
          label: 'Reimport', 
          onClick: () => reimportGameObject(objectId), 
          shortcut: '⌃⇧R' 
        },
        { label: 'Configure...', onClick: () => console.log('Configure Reimport') },
      ],
    },
    { divider: true },
    {
      label: 'Convert to Package',
      onClick: () => console.log('Convert to Package', objectId),
    },
    {
      label: 'Save / Export',
      submenu: [
        { label: 'Save Selection', onClick: () => console.log('Save Selection') },
        { label: 'Export Selection', onClick: () => console.log('Export Selection') },
        { label: 'Export as FBX', onClick: () => console.log('Export as FBX') },
        { label: 'Export as OBJ', onClick: () => console.log('Export as OBJ') },
      ],
    },
    { divider: true },
    {
      label: 'Help',
      onClick: () => console.log('Help'),
    },
  ]

  return (
    <>
      <div
        className={`${styles.treeNode} ${isWorkspaceRoot ? styles.workspaceGroup : ''} ${hasChildren ? styles.hasChildrenGroup : ''}`}
        style={hasChildren ? ({ '--tree-line-left': `${depth * 16 + 16}px` } as React.CSSProperties) : undefined}
      >
        <div
          className={`${styles.nodeRow} ${isSelected ? styles.selected : ''} ${isSelected && hasChildren ? styles.selectedParent : ''} ${isSelected && !hasChildren ? styles.selectedChild : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) =>
            selectObject(objectId, {
              additive: e.ctrlKey || e.metaKey,
              range: e.shiftKey,
            })
          }
          onContextMenu={contextMenu.openContextMenu}
          onMouseDown={(e) => {
            // Handle control+click as context menu (for Mac)
            if (e.ctrlKey && e.button === 0) {
              contextMenu.openContextMenu(e)
            }
          }}
        >
          <button 
            className={`${styles.expandBtn} ${!hasChildren ? styles.hidden : ''}`}
            onClick={toggleExpanded}
          >
            {hasChildren && (isExpanded ? <ExpandDownIcon /> : <ExpandRightIcon />)}
          </button>

          <span className={styles.typeIcon}>
            {obj.parentId === null && obj.name === 'Workspace' ? (
              <img src="/icons/workspace.svg" alt="Workspace" width={16} height={16} />
            ) : obj.name === 'Drops' ? (
              <img src="/icons/folder.svg" alt="Drops" width={16} height={16} />
            ) : (
              typeIcons[obj.type]
            )}
          </span>

          <span className={`${styles.name} ${!obj.visible ? styles.dimmed : ''}`}>
            {obj.name}
          </span>

          <div className={styles.nodeActions}>
            <button 
              className={`${styles.actionBtn} ${!obj.visible ? styles.active : ''}`}
              onClick={toggleVisibility}
            >
              {obj.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button 
              className={`${styles.actionBtn} ${obj.locked ? styles.active : ''}`}
              onClick={toggleLock}
            >
              {obj.locked ? <Lock size={16} /> : <Unlock size={16} />}
            </button>
          </div>

          {showProgress && <ReimportProgress isCompleting={isCompleting} />}
        </div>

        {hasChildren && isExpanded && (
          <div className={styles.children}>
            {obj.children.map((childId) => (
              <TreeNode key={childId} objectId={childId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>

      <ContextMenu
        items={menuItems}
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={contextMenu.closeContextMenu}
      />
    </>
  )
}

export function Hierarchy() {
  const { rootObjectIds, createGameObject } = useEditorStore()
  const [showCreateMenu, setShowCreateMenu] = useState(false)

  const createOptions: { type: GameObjectType; label: string }[] = [
    { type: 'empty', label: 'Empty Object' },
    { type: 'mesh', label: 'Mesh' },
    { type: 'sprite', label: 'Sprite' },
    { type: 'camera', label: 'Camera' },
    { type: 'light', label: 'Light' },
    { type: 'audio', label: 'Audio Source' },
    { type: 'particle', label: 'Particle System' },
    { type: 'tilemap', label: 'Tilemap' },
  ]

  return (
    <DockablePanel
      widgetId="explorer"
      title="Explorer"
      actions={
        <div className={styles.createWrapper}>
          <IconButton
            icon={<Plus size={16} />}
            tooltip="Create GameObject"
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            size="sm"
            variant="ghost"
          />
          {showCreateMenu && (
            <div className={styles.createMenu}>
              {createOptions.map((option) => (
                <button
                  key={option.type}
                  className={styles.createOption}
                  onClick={() => {
                    createGameObject(option.type)
                    setShowCreateMenu(false)
                  }}
                >
                  {typeIcons[option.type]}
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <div className={styles.tree}>
        {rootObjectIds.map((id) => (
          <TreeNode key={id} objectId={id} depth={0} />
        ))}
      </div>
    </DockablePanel>
  )
}




