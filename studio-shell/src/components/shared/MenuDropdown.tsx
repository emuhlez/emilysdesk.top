import { useState, useRef, useLayoutEffect } from 'react'
import { ExpandRightIcon } from './ExpandIcons'
import styles from './MenuDropdown.module.css'

export interface MenuDropdownProps {
  items: MenuItem[]
  isOpen: boolean
  onClose: () => void
  className?: string
}

export interface MenuItem {
  label?: string
  onClick?: () => void
  divider?: boolean
  shortcut?: string
  icon?: React.ReactNode
  submenu?: MenuItem[]
  /** Optional sticky footer item (e.g. "New chat" pinned to bottom) */
  isStickyFooter?: boolean
}

/**
 * Nudge an absolutely/fixed-positioned element back inside the viewport
 * using a corrective CSS transform. Skips elements with relative/static
 * positioning (e.g. when MenuDropdown is nested inside ContextMenu).
 */
function clampToViewport(el: HTMLElement, pad = 8) {
  const pos = getComputedStyle(el).position
  if (pos === 'relative' || pos === 'static') return

  el.style.transform = ''
  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let dx = 0
  let dy = 0

  if (rect.right > vw - pad) dx = (vw - pad) - rect.right
  if (rect.left + dx < pad) dx = pad - rect.left
  if (rect.bottom > vh - pad) dy = (vh - pad) - rect.bottom
  if (rect.top + dy < pad) dy = pad - rect.top

  if (dx !== 0 || dy !== 0) {
    el.style.transform = `translate(${dx}px, ${dy}px)`
  }
}

function SubmenuItem({ item, onClose, isHovered }: { item: MenuItem; onClose: () => void; isHovered: boolean }) {
  const submenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isHovered || !submenuRef.current) return

    const el = submenuRef.current
    // Reset to default CSS position before measuring
    el.style.left = ''
    el.style.right = ''
    el.style.transform = ''

    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 8

    // Flip to the left side of the parent if overflowing right
    if (rect.right > vw - pad) {
      el.style.left = 'auto'
      el.style.right = 'calc(100% - 4px)'
    }

    // Nudge vertically if overflowing top or bottom
    let dy = 0
    if (rect.bottom > vh - pad) dy = (vh - pad) - rect.bottom
    if (rect.top + dy < pad) dy = pad - rect.top
    if (dy !== 0) {
      el.style.transform = `translateY(${dy}px)`
    }
  }, [isHovered])

  if (!isHovered) return null

  return (
    <div ref={submenuRef} className={styles.submenu}>
      {item.submenu!.map((subItem, subIndex) => {
        if (subItem.divider) {
          return <div key={`subdiv-${subIndex}`} className={styles.dropdownDivider} />
        }
        return (
          <button
            key={subItem.label || `subitem-${subIndex}`}
            className={styles.dropdownItem}
            onClick={() => {
              subItem.onClick?.()
              onClose()
            }}
          >
            <span>{subItem.label}</span>
            {subItem.shortcut && (
              <span className={styles.shortcut}>{subItem.shortcut}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function MenuDropdown({ items, isOpen, onClose, className }: MenuDropdownProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!isOpen || !dropdownRef.current) return
    clampToViewport(dropdownRef.current)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div ref={dropdownRef} className={`${styles.menuDropdown} ${className ?? ''}`.trim()}>
      {items.map((item, index) => {
        if (item.divider) {
          return <div key={`divider-${index}`} className={styles.dropdownDivider} />
        }
        
        const hasSubmenu = item.submenu && item.submenu.length > 0
        const isHovered = hoveredIndex === index

        return (
          <div
            key={`item-${index}`}
            className={styles.menuItemWrapper}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <button
              className={`${styles.dropdownItem} ${item.isStickyFooter ? styles.dropdownItemStickyFooter : ''}`.trim()}
              onClick={() => {
                if (!hasSubmenu) {
                  item.onClick?.()
                  onClose()
                }
              }}
            >
              <span>{item.icon}{item.label}</span>
              <span className={styles.shortcutGroup}>
                {item.shortcut && (
                  <span className={styles.shortcut}>{item.shortcut}</span>
                )}
                {hasSubmenu && <ExpandRightIcon />}
              </span>
            </button>
            
            {hasSubmenu && (
              <SubmenuItem item={item} onClose={onClose} isHovered={isHovered} />
            )}
          </div>
        )
      })}
    </div>
  )
}

