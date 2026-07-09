import { useState, useRef, useEffect } from 'react'
import { TabHeader, type Tab } from './TabHeader'
import { useDockingStore } from '../../store/dockingStore'
import { detectEdgeZone } from '../../utils/dockDrop'
import type { DockZone } from '../../types'
import type { ReactNode } from 'react'
import styles from './TabbedPanel.module.css'

interface TabbedPanelProps {
  tabs: Tab[]
  tabContents: Record<string, ReactNode>
  zone: DockZone
  title?: string
  className?: string
}

const DRAG_THRESHOLD = 5

export function TabbedPanel({ tabs, tabContents, zone, title, className }: TabbedPanelProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id || '')
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [_targetZone, setTargetZone] = useState<DockZone | null>(null)
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const draggingTabIdRef = useRef<string | null>(null)

  const dockWidget = useDockingStore((state) => state.dockWidget)
  const undockWidget = useDockingStore((state) => state.undockWidget)
  const setDraggingWidgetId = useDockingStore((state) => state.setDraggingWidgetId)
  const setAiAssistantBodyCollapsed = useDockingStore((state) => state.setAiAssistantBodyCollapsed)

  useEffect(() => {
    if (!tabs.find((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0]?.id || '')
    }
  }, [tabs, activeTabId])

  const handleTabClose = (tabId: string) => {
    if (tabs.length <= 1) return

    if (tabId === activeTabId) {
      const currentIndex = tabs.findIndex((t) => t.id === tabId)
      const newIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex + 1
      if (tabs[newIndex]) {
        setActiveTabId(tabs[newIndex].id)
      }
    }

    undockWidget(tabId)
  }

  useEffect(() => {
    if (!isDragging) {
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
      return
    }

    document.body.classList.add('dragging-widget')
    document.body.style.cursor = 'grabbing'

    let rafId: number | null = null
    const handleMouseMove = (e: MouseEvent) => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const store = useDockingStore.getState()
        const bounds = store.viewportBounds

        setDragPosition({ x: e.clientX, y: e.clientY })

        const detectedZone = detectEdgeZone(e.clientX, e.clientY, bounds)

        document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
        setTargetZone(detectedZone)

        if (detectedZone && (detectedZone !== zone || store.studioMode === 'ribbon')) {
          const edgeMap: Record<string, string> = {
            'center-bottom': 'bottom',
            'right-bottom': 'right',
            left: 'left',
            'center-top': 'top',
            'right-top': 'center',
          }
          const edgeAttr = edgeMap[detectedZone]
          if (edgeAttr) {
            document.querySelector(`[data-edge="${edgeAttr}"]`)?.classList.add('dragOver')
          } else {
            document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-zone]')?.classList.add('dragOver')
          }
        }
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      const singleTabId = draggingTabIdRef.current
      setIsDragging(false)
      setDraggingTabId(null)
      draggingTabIdRef.current = null
      setDraggingWidgetId(null)
      setTargetZone(null)

      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))

      const store = useDockingStore.getState()

      const dropZone = detectEdgeZone(e.clientX, e.clientY, store.viewportBounds)

      const widgetsToMove = singleTabId ? [singleTabId] : tabs.map((t) => t.id)

      if (dropZone && (dropZone !== zone || store.studioMode === 'ribbon')) {
        widgetsToMove.forEach((id) => dockWidget(id, dropZone!))
        widgetsToMove.forEach((id) => {
          if (id === 'ai-assistant') setAiAssistantBodyCollapsed(false)
        })
      }

      document.body.style.cursor = ''
    }

    const preventInteraction = (ev: Event) => {
      ev.preventDefault()
      ev.stopPropagation()
    }

    document.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseup', handleMouseUp)
    document.addEventListener('click', preventInteraction, true)
    document.addEventListener('mousedown', preventInteraction, true)
    document.addEventListener('contextmenu', preventInteraction, true)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('click', preventInteraction, true)
      document.removeEventListener('mousedown', preventInteraction, true)
      document.removeEventListener('contextmenu', preventInteraction, true)
      document.querySelectorAll('[data-zone], [data-edge]').forEach((el) => el.classList.remove('dragOver'))
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
    }
  }, [isDragging, zone, tabs, dockWidget, setDraggingWidgetId, setAiAssistantBodyCollapsed])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    const target = e.target as HTMLElement
    if (target.closest('[aria-label="Close"]')) return

    const tabEl = target.closest('[data-tab-id]')
    const clickedTabId = tabEl?.getAttribute('data-tab-id') ?? null
    if (!clickedTabId) return

    const startX = e.clientX
    const startY = e.clientY

    const handlePreDragMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        cleanup()
        setDraggingTabId(clickedTabId)
        draggingTabIdRef.current = clickedTabId
        setIsDragging(true)
        setDraggingWidgetId(clickedTabId)
        document.body.style.cursor = 'grabbing'
      }
    }
    const handlePreDragUp = () => {
      cleanup()
    }
    const cleanup = () => {
      document.removeEventListener('mousemove', handlePreDragMove)
      document.removeEventListener('mouseup', handlePreDragUp)
    }
    document.addEventListener('mousemove', handlePreDragMove)
    document.addEventListener('mouseup', handlePreDragUp)
    e.preventDefault()
  }

  const activeContent = tabContents[activeTabId]

  return (
    <>
      <div
        ref={panelRef}
        className={`${styles.tabbedPanel} ${className || ''} ${isDragging ? styles.dragging : ''}`}
      >
        <div className={styles.panelContainer}>
          <div
            ref={headerRef}
            className={`${styles.draggableHeader} ${isDragging ? styles.dragging : ''}`}
            onMouseDown={handleMouseDown}
          >
            <TabHeader
              tabs={tabs}
              activeTabId={activeTabId}
              onTabSelect={setActiveTabId}
              onTabClose={handleTabClose}
              title={title}
            />
          </div>
          <div className={styles.panelContent}>{activeContent}</div>
        </div>
      </div>

      {isDragging &&
        draggingTabId &&
        (() => {
          const dragTab = tabs.find((t) => t.id === draggingTabId)
          if (!dragTab) return null
          return (
            <div
              className={styles.dragPreview}
              style={{ left: dragPosition.x, top: dragPosition.y }}
            >
              <div className={styles.dragPreviewContent}>
                <TabHeader
                  tabs={[dragTab]}
                  activeTabId={draggingTabId}
                  onTabSelect={() => {}}
                  title={title}
                />
                <div className={styles.dragPreviewBody}>{tabContents[draggingTabId]}</div>
              </div>
            </div>
          )
        })()}
    </>
  )
}
