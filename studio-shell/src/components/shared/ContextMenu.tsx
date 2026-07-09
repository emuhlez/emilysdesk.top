import React, { useEffect, useRef, useState } from 'react'
import { MenuDropdown, MenuItem } from './MenuDropdown'
import styles from './ContextMenu.module.css'

/**
 * ContextMenu component - displays a context menu at a specific position
 * 
 * Usage example:
 * ```tsx
 * function MyComponent() {
 *   const contextMenu = useContextMenu()
 * 
 *   const menuItems: MenuItem[] = [
 *     { label: 'Copy', onClick: () => console.log('Copy'), shortcut: '⌘C' },
 *     { label: 'Paste', onClick: () => console.log('Paste'), shortcut: '⌘V' },
 *     { divider: true },
 *     { label: 'Delete', onClick: () => console.log('Delete'), shortcut: 'Del' },
 *   ]
 * 
 *   return (
 *     <>
 *       <div
 *         onContextMenu={contextMenu.openContextMenu}
 *         onMouseDown={(e) => {
 *           // Handle control+click as context menu
 *           if (e.ctrlKey && e.button === 0) {
 *             contextMenu.openContextMenu(e)
 *           }
 *         }}
 *       >
 *         Right-click or Ctrl+Click me!
 *       </div>
 *       
 *       <ContextMenu
 *         items={menuItems}
 *         isOpen={contextMenu.isOpen}
 *         position={contextMenu.position}
 *         onClose={contextMenu.closeContextMenu}
 *       />
 *     </>
 *   )
 * }
 * ```
 */
export interface ContextMenuProps {
  items: MenuItem[]
  isOpen: boolean
  position: { x: number; y: number }
  onClose: () => void
}

export function ContextMenu({ items, isOpen, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Adjust position to keep menu within viewport bounds
  useEffect(() => {
    if (!isOpen || !menuRef.current) return

    const menu = menuRef.current
    const rect = menu.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let { x, y } = position

    // Check right edge
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10 // 10px padding from edge
    }

    // Check left edge
    if (x < 0) {
      x = 10
    }

    // Check bottom edge
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10 // 10px padding from edge
    }

    // Check top edge
    if (y < 0) {
      y = 10
    }

    setAdjustedPosition({ x, y })
  }, [isOpen, position])

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    // Add small delay to prevent immediate close from the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }, 0)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      <MenuDropdown items={items} isOpen={isOpen} onClose={onClose} />
    </div>
  )
}

export interface UseContextMenuReturn {
  isOpen: boolean
  position: { x: number; y: number }
  openContextMenu: (event: React.MouseEvent) => void
  closeContextMenu: () => void
}

/**
 * Hook to manage context menu state
 * Handles both right-click and control+click
 */
export function useContextMenu(): UseContextMenuReturn {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  const openContextMenu = (event: React.MouseEvent) => {
    // Check for right-click or control+click
    if (event.button === 2 || (event.button === 0 && event.ctrlKey)) {
      event.preventDefault()
      event.stopPropagation()
      
      setPosition({ x: event.clientX, y: event.clientY })
      setIsOpen(true)
    }
  }

  const closeContextMenu = () => {
    setIsOpen(false)
  }

  return {
    isOpen,
    position,
    openContextMenu,
    closeContextMenu,
  }
}
