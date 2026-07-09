import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight } from 'lucide-react'
import type { MentionQuery, PillInputHandle, PillKind } from '../../types'
import styles from './MentionDropdown.module.css'

export interface MentionItem {
  id: string
  label: string
  kind: PillKind
  category: 'script' | 'folder' | 'active-tab' | 'doc'
  /** For scene objects: the GameObject type or primitiveType, used to pick the right icon */
  objectType?: string
}

interface MentionDropdownProps {
  mention: MentionQuery | null
  items: MentionItem[]
  pillInputRef: React.RefObject<PillInputHandle | null>
  onClose: () => void
}

type CategoryKey = 'script' | 'folder' | 'active-tab' | 'doc'

const CATEGORY_ORDER: CategoryKey[] = ['script', 'folder', 'active-tab', 'doc']
const CATEGORY_LABELS: Record<CategoryKey, string> = {
  script: 'Scripts',
  folder: 'Folders',
  'active-tab': 'Active Tabs',
  doc: 'Docs',
}

const SUBMENU_HOVER_DELAY_MS = 120

/** Must match `.subMenu { max-height }` in MentionDropdown.module.css */
const SUBMENU_MAX_HEIGHT_PX = 240

export function MentionDropdown({ mention, items, pillInputRef, onClose }: MentionDropdownProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const subMenuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(0)
  const subSelectedRef = useRef(0)
  const closeSubMenuTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null)
  const [subSelected, setSubSelected] = useState(0)
  const prevExpandedCategoryRef = useRef<CategoryKey | null>(null)
  /** When true, opening a category submenu should highlight the last item (wrap ↑ from first main row). */
  const openSubmenuAtLastItemRef = useRef(false)

  const clearCloseSubMenuTimeout = useCallback(() => {
    if (closeSubMenuTimeoutRef.current !== null) {
      clearTimeout(closeSubMenuTimeoutRef.current)
      closeSubMenuTimeoutRef.current = null
    }
  }, [])

  const scheduleCloseSubMenu = useCallback(() => {
    clearCloseSubMenuTimeout()
    closeSubMenuTimeoutRef.current = setTimeout(() => {
      closeSubMenuTimeoutRef.current = null
      setExpandedCategory(null)
    }, SUBMENU_HOVER_DELAY_MS)
  }, [clearCloseSubMenuTimeout])

  const hasQuery = mention ? mention.query.length > 0 : false

  const filtered = useMemo(() => {
    if (!mention) return []
    const q = mention.query.toLowerCase()
    return items.filter((item) => item.label.toLowerCase().includes(q))
  }, [mention, items])

  // When no query: group all items for sub-menus. When query: group filtered items for inline list.
  const groups = useMemo(() => {
    const source = hasQuery ? filtered : items
    const map = new Map<string, MentionItem[]>()
    for (const item of source) {
      const arr = map.get(item.category) ?? []
      arr.push(item)
      map.set(item.category, arr)
    }
    return CATEGORY_ORDER
      .filter((cat) => map.has(cat))
      .map((cat) => ({ category: cat, label: CATEGORY_LABELS[cat], items: map.get(cat)! }))
  }, [hasQuery, filtered, items])

  const flatItems = useMemo(() => groups.flatMap((g) => g.items), [groups])

  const updateSubMenuHighlight = useCallback(() => {
    const options = subMenuRef.current?.querySelectorAll('[role="option"]')
    const idx = subSelectedRef.current
    options?.forEach((el, i) => {
      ;(el as HTMLElement).dataset.selected = String(i === idx)
    })
    options?.[idx]?.scrollIntoView({ block: 'nearest' })
  }, [])

  const updateHighlight = useCallback(() => {
    const options = menuRef.current?.querySelectorAll('[role="option"]')
    options?.forEach((el, i) => {
      ;(el as HTMLElement).dataset.selected = String(i === selectedRef.current)
    })
    options?.[selectedRef.current]?.scrollIntoView({ block: 'nearest' })
  }, [])

  // Reset selection when query changes — layout so refs are correct before highlight sync paint
  useLayoutEffect(() => {
    selectedRef.current = 0
    subSelectedRef.current = 0
    setSubSelected(0)
    setExpandedCategory(null)
    clearCloseSubMenuTimeout()
  }, [mention?.query, clearCloseSubMenuTimeout])

  /** Sync keyboard selection ring with DOM on open and when list geometry changes */
  useLayoutEffect(() => {
    if (!mention) return
    if (hasQuery && flatItems.length === 0) return
    if (!hasQuery && groups.length === 0) return

    const maxIdx = hasQuery ? flatItems.length - 1 : groups.length - 1
    selectedRef.current = Math.min(Math.max(0, selectedRef.current), maxIdx)
    updateHighlight()
  }, [mention, hasQuery, flatItems.length, groups.length, updateHighlight])

  // Clear close timeout on unmount
  useEffect(() => {
    return () => clearCloseSubMenuTimeout()
  }, [clearCloseSubMenuTimeout])

  // Submenu open / category switch: reset sub-cursor to first item
  useLayoutEffect(() => {
    if (expandedCategory === null || hasQuery) {
      prevExpandedCategoryRef.current = null
      return
    }
    const group = groups.find((g) => g.category === expandedCategory)
    if (!group || group.items.length === 0) return

    const switched = prevExpandedCategoryRef.current !== expandedCategory
    prevExpandedCategoryRef.current = expandedCategory

    if (switched) {
      if (openSubmenuAtLastItemRef.current) {
        openSubmenuAtLastItemRef.current = false
        const last = Math.max(0, group.items.length - 1)
        subSelectedRef.current = last
        setSubSelected(last)
      } else {
        subSelectedRef.current = 0
        setSubSelected(0)
      }
    } else {
      const max = group.items.length - 1
      if (subSelectedRef.current > max) {
        subSelectedRef.current = Math.max(0, max)
        setSubSelected(subSelectedRef.current)
      }
    }
    updateSubMenuHighlight()
  }, [expandedCategory, hasQuery, groups, updateSubMenuHighlight])

  const selectItem = useCallback(
    (item: MentionItem) => {
      pillInputRef.current?.replaceMentionWithPill({
        id: item.id,
        label: item.label,
        kind: item.kind,
        objectType: item.objectType,
      })
      setExpandedCategory(null)
      onClose()
    },
    [pillInputRef, onClose],
  )

  // Close sub-menu on click outside
  useEffect(() => {
    if (expandedCategory === null) return
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current?.contains(target) ||
        subMenuRef.current?.contains(target)
      ) return
      setExpandedCategory(null)
    }
    document.addEventListener('mousedown', handleMouseDown, true)
    return () => document.removeEventListener('mousedown', handleMouseDown, true)
  }, [expandedCategory])

  // Keyboard navigation
  useEffect(() => {
    if (!mention) return

    const handler = (e: KeyboardEvent) => {
      // ── Flat query list ──────────────────────────────────────────────────────
      if (hasQuery) {
        if (flatItems.length === 0) return
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          selectedRef.current = Math.min(selectedRef.current + 1, flatItems.length - 1)
          updateHighlight()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          selectedRef.current = Math.max(selectedRef.current - 1, 0)
          updateHighlight()
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (flatItems[selectedRef.current]) {
            e.preventDefault()
            e.stopPropagation()
            selectItem(flatItems[selectedRef.current])
          }
        }
        return
      }

      // ── No query: submenu captures arrows when open ───────────────────────────
      const expandedGroup =
        expandedCategory !== null ? groups.find((g) => g.category === expandedCategory) : null
      const subItems = expandedGroup?.items ?? []

      if (expandedCategory !== null && subItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          if (subSelectedRef.current >= subItems.length - 1) {
            clearCloseSubMenuTimeout()
            const nextCatIdx = selectedRef.current + 1
            if (nextCatIdx < groups.length) {
              selectedRef.current = nextCatIdx
              updateHighlight()
              setExpandedCategory(groups[nextCatIdx].category)
            } else {
              setExpandedCategory(null)
              updateHighlight()
            }
          } else {
            const next = subSelectedRef.current + 1
            subSelectedRef.current = next
            setSubSelected(next)
            updateSubMenuHighlight()
          }
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          if (subSelectedRef.current === 0) {
            clearCloseSubMenuTimeout()
            setExpandedCategory(null)
            updateHighlight()
          } else {
            const next = subSelectedRef.current - 1
            subSelectedRef.current = next
            setSubSelected(next)
            updateSubMenuHighlight()
          }
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          const item = subItems[subSelectedRef.current]
          if (item) {
            e.preventDefault()
            e.stopPropagation()
            selectItem(item)
          }
        } else if (e.key === 'ArrowLeft' || e.key === 'Escape') {
          // Close submenu, return to category list
          e.preventDefault()
          setExpandedCategory(null)
        }
        return
      }

      // ── Category list ─────────────────────────────────────────────────────────
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        selectedRef.current = Math.min(selectedRef.current + 1, groups.length - 1)
        updateHighlight()
        const nextGroup = groups[selectedRef.current]
        if (nextGroup) {
          clearCloseSubMenuTimeout()
          setExpandedCategory(nextGroup.category)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (selectedRef.current === 0 && groups.length > 0) {
          clearCloseSubMenuTimeout()
          const lastCatIdx = groups.length - 1
          selectedRef.current = lastCatIdx
          updateHighlight()
          openSubmenuAtLastItemRef.current = true
          setExpandedCategory(groups[lastCatIdx].category)
        } else {
          selectedRef.current = Math.max(selectedRef.current - 1, 0)
          updateHighlight()
          const prevGroup = groups[selectedRef.current]
          if (prevGroup) {
            clearCloseSubMenuTimeout()
            setExpandedCategory(prevGroup.category)
          }
        }
      } else if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'ArrowRight') {
        const group = groups[selectedRef.current]
        if (group && group.items.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          clearCloseSubMenuTimeout()
          setExpandedCategory(group.category)
        }
      }
    }

    document.addEventListener('keydown', handler, true)
    return () => document.removeEventListener('keydown', handler, true)
  }, [
    mention,
    hasQuery,
    flatItems,
    groups,
    selectItem,
    expandedCategory,
    updateHighlight,
    updateSubMenuHighlight,
    clearCloseSubMenuTimeout,
  ])

  if (!mention) return null
  if (hasQuery && flatItems.length === 0) return null
  if (!hasQuery && groups.length === 0) return null

  const { rect } = mention
  const MAIN_WIDTH = 280
  const EDGE_PAD = 8
  const clampedLeft = Math.min(rect.left, window.innerWidth - MAIN_WIDTH - EDGE_PAD)
  const mainStyle: React.CSSProperties = {
    left: Math.max(EDGE_PAD, clampedLeft),
    top: rect.top - 6,
    transform: 'translateY(-100%)',
  }

  // No query: category rows with expandable sub-menus
  if (!hasQuery) {
    const dropdown = (
      <>
        <div
          ref={menuRef}
          className={styles.dropdown}
          style={mainStyle}
          role="listbox"
          aria-label="Mention"
          data-node-id="1181:1558"
        >
          {groups.map((group, i) => (
            <div
              key={group.category}
              className={styles.categoryRow}
              role="option"
              data-selected={String(i === selectedRef.current)}
              aria-selected={i === selectedRef.current}
              onMouseEnter={() => {
                clearCloseSubMenuTimeout()
                selectedRef.current = i
                updateHighlight()
                setExpandedCategory(group.category)
              }}
              onMouseLeave={scheduleCloseSubMenu}
              onMouseDown={(e) => {
                e.preventDefault()
                setExpandedCategory((prev) => (prev === group.category ? null : group.category))
              }}
            >
              <span className={styles.categoryLabel}>{group.label}</span>
              <ChevronRight size={14} className={styles.categoryChevron} />
            </div>
          ))}
        </div>
        {expandedCategory !== null && (() => {
          const group = groups.find((g) => g.category === expandedCategory)
          if (!group || group.items.length === 0) return null
          const subRect = menuRef.current?.getBoundingClientRect()
          // Get the bounding rect of the currently active category row so the
          // submenu centers on that specific row rather than the whole menu.
          const activeRowEl = menuRef.current?.querySelectorAll('[role="option"]')[selectedRef.current] as HTMLElement | undefined
          const rowRect = activeRowEl?.getBoundingClientRect()
          const SUB_WIDTH = 220
          const EDGE_PAD_INNER = 8
          const vw = window.innerWidth
          const vh = window.innerHeight
          let subLeft: number
          let subTop: number
          if (subRect) {
            const rightOverflow = subRect.right + 8 + SUB_WIDTH > vw - EDGE_PAD_INNER
            subLeft = rightOverflow
              ? Math.max(EDGE_PAD_INNER, subRect.left - 8 - SUB_WIDTH)
              : subRect.right + 8
            const estimatedSubHeight = Math.min(
              group.items.length * 30 + 10,
              SUBMENU_MAX_HEIGHT_PX,
            )
            // Center submenu on the hovered row so every category — including
            // "Docs" at the bottom — aligns naturally to its own row.
            const rowMidY = rowRect
              ? rowRect.top + rowRect.height / 2
              : subRect.top + subRect.height / 2
            const centeredTop = rowMidY - estimatedSubHeight / 2
            subTop = Math.min(centeredTop, vh - estimatedSubHeight - EDGE_PAD_INNER)
            subTop = Math.max(EDGE_PAD_INNER, subTop)
          } else {
            subLeft = rect.left + 224
            subTop = rect.top - 6
          }
          return createPortal(
            <div
              ref={subMenuRef}
              className={styles.subMenu}
              style={{ left: subLeft, top: subTop }}
              role="listbox"
              aria-label={group.label}
              onMouseEnter={clearCloseSubMenuTimeout}
              onMouseLeave={scheduleCloseSubMenu}
            >
              {group.items.map((item, i) => (
                <div
                  key={item.id}
                  className={styles.option}
                  role="option"
                  data-selected={String(i === subSelected)}
                  aria-selected={i === subSelected}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectItem(item)
                  }}
                >
                  <span className={styles.label}>{item.label}</span>
                </div>
              ))}
            </div>,
            document.body
          )
        })()}
      </>
    )
    return createPortal(dropdown, document.body)
  }

  // Has query: flat grouped list
  let flatIdx = 0
  const dropdown = (
    <div
      ref={menuRef}
      className={styles.dropdown}
      style={mainStyle}
      role="listbox"
      aria-label="Mention"
      data-node-id="1181:1558"
    >
      {groups.map((group) => (
        <div key={group.category} className={styles.section}>
          <div className={styles.categoryHeader} aria-hidden>
            <span className={styles.categoryLabel}>{group.label}</span>
          </div>
          {group.items.map((item) => {
            const i = flatIdx++
            return (
              <div
                key={item.id}
                className={styles.option}
                role="option"
                data-selected={String(i === selectedRef.current)}
                aria-selected={i === selectedRef.current}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectItem(item)
                }}
              >
                <span className={styles.label}>{item.label}</span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )

  return createPortal(dropdown, document.body)
}
