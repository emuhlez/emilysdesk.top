import { useRef, useState, useEffect } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { PanelHeader } from './Panel'
import { useDockingStore } from '../../store/dockingStore'
import { useWidgetMetadataStore } from '../../store/widgetMetadataStore'
import { detectEdgeZone } from '../../utils/dockDrop'
import type { DockZone } from '../../types'
import type { ReactNode } from 'react'
import styles from './DockablePanel.module.css'

interface DockablePanelProps {
  widgetId: string
  title: string
  children: ReactNode
  actions?: ReactNode
  titleLeading?: ReactNode
  titleTrailing?: ReactNode
  headerMiddle?: ReactNode
  headerCenterTitle?: boolean
  headerTitleFirst?: boolean
  className?: string
  hideCloseButton?: boolean
  bodyCollapsed?: boolean
  collapsedShowsMinimalContent?: boolean
  hideHeaderWhenCollapsed?: boolean
  collapsedHeaderContent?: ReactNode
  contentFills?: boolean
  onClose?: () => void
}

export function DockablePanel({
  widgetId,
  title,
  children,
  actions,
  titleLeading,
  titleTrailing,
  headerMiddle,
  headerCenterTitle,
  headerTitleFirst,
  className,
  hideCloseButton = true,
  bodyCollapsed = false,
  collapsedShowsMinimalContent = false,
  hideHeaderWhenCollapsed = false,
  collapsedHeaderContent,
  contentFills = false,
  onClose,
}: DockablePanelProps) {
  const headerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 })
  const [_targetZone, setTargetZone] = useState<DockZone | null>(null)

  const dockWidget = useDockingStore((state) => state.dockWidget)
  const undockWidget = useDockingStore((state) => state.undockWidget)
  const widget = useDockingStore((state) => state.widgets[widgetId])
  const getWidgetsInZone = useDockingStore((state) => state.getWidgetsInZone)
  const centerBottomCollapsed = useDockingStore((state) => state.centerBottomCollapsed)
  const toggleCenterBottomCollapsed = useDockingStore((state) => state.toggleCenterBottomCollapsed)
  const setDraggingWidgetId = useDockingStore((state) => state.setDraggingWidgetId)
  const setAiAssistantBodyCollapsed = useDockingStore((state) => state.setAiAssistantBodyCollapsed)
  const registerWidget = useWidgetMetadataStore((state) => state.registerWidget)

  useEffect(() => {
    registerWidget(widgetId, { title, actions })
  }, [widgetId, title, actions, registerWidget])

  const widgetsInZone = widget ? getWidgetsInZone(widget.zone) : []
  const isInTabbedPanel = widgetsInZone.length > 1

  useEffect(() => {
    if (!isDragging) {
      document
        .querySelectorAll('[data-zone], [data-edge], [data-split-pane]')
        .forEach((el) => el.classList.remove('dragOver'))
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
        const currentWidget = store.widgets[widgetId]

        setDragPosition({ x: e.clientX, y: e.clientY })

        const detectedZone = detectEdgeZone(e.clientX, e.clientY, bounds)

        document
          .querySelectorAll('[data-zone], [data-edge], [data-split-pane]')
          .forEach((el) => el.classList.remove('dragOver'))
        setTargetZone(detectedZone)

        if (
          detectedZone &&
          (detectedZone !== currentWidget?.zone || store.studioMode === 'ribbon')
        ) {
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
      setIsDragging(false)
      setDraggingWidgetId(null)
      setTargetZone(null)

      document
        .querySelectorAll('[data-zone], [data-edge], [data-split-pane]')
        .forEach((el) => el.classList.remove('dragOver'))

      const store = useDockingStore.getState()
      const bounds = store.viewportBounds
      const currentWidget = store.widgets[widgetId]

      const dropZone = detectEdgeZone(e.clientX, e.clientY, bounds)

      if (
        dropZone &&
        (dropZone !== currentWidget?.zone || store.studioMode === 'ribbon')
      ) {
        dockWidget(widgetId, dropZone)
        if (widgetId === 'ai-assistant') setAiAssistantBodyCollapsed(false)
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
      document
        .querySelectorAll('[data-zone], [data-edge], [data-split-pane]')
        .forEach((el) => el.classList.remove('dragOver'))
      document.body.classList.remove('dragging-widget')
      document.body.style.cursor = ''
    }
  }, [isDragging, widgetId, dockWidget, setDraggingWidgetId, setAiAssistantBodyCollapsed])

  const isCenterBottomCollapsed = widget?.zone === 'center-bottom' && centerBottomCollapsed

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (isInTabbedPanel) return

    if (isCenterBottomCollapsed) {
      toggleCenterBottomCollapsed()
      return
    }

    const target = e.target as HTMLElement
    const isInteractive = target.closest('button, input, a, [role="button"]') !== null
    if (isInteractive) return

    setIsDragging(true)
    setDraggingWidgetId(widgetId)
    document.body.style.cursor = 'grabbing'
    e.preventDefault()
    e.stopPropagation()
  }

  const closeButtonEl = !hideCloseButton ? (
    <button
      type="button"
      className={styles.collapseButton}
      onClick={(ev) => {
        ev.stopPropagation()
        if (onClose) onClose()
        else undockWidget(widgetId)
      }}
      aria-label="Close panel"
    >
      <X size={14} />
    </button>
  ) : null

  const headerActionsEl = (
    <>
      {widget?.zone === 'center-bottom' && !centerBottomCollapsed && (
        <button
          type="button"
          className={styles.collapseButton}
          onClick={(ev) => {
            ev.stopPropagation()
            toggleCenterBottomCollapsed()
          }}
          aria-label="Collapse panel"
        >
          <ChevronDown size={16} />
        </button>
      )}
      {actions}
      {closeButtonEl}
    </>
  )

  const panelContentClass = `${styles.panelContent} ${
    bodyCollapsed && !collapsedShowsMinimalContent ? styles.panelContentCollapsed : ''
  } ${bodyCollapsed && collapsedShowsMinimalContent ? styles.panelContentMinimal : ''} ${
    contentFills && !(bodyCollapsed && collapsedShowsMinimalContent) ? styles.panelContentFills : ''
  }`.replace(/\s+/g, ' ').trim()

  const renderHeader = () => {
    if (bodyCollapsed && hideHeaderWhenCollapsed) return null
    return (
      <div
        ref={headerRef}
        className={`${styles.draggableHeader} ${isDragging ? styles.dragging : ''} ${isCenterBottomCollapsed ? styles.collapsedHeader : ''}`.trim()}
        onMouseDown={handleMouseDown}
      >
        <PanelHeader
          title={title}
          titleLeading={titleLeading}
          titleTrailing={titleTrailing}
          centerTitle={headerCenterTitle}
          titleFirst={headerTitleFirst}
          middle={bodyCollapsed ? collapsedHeaderContent : undefined}
          actions={headerActionsEl}
        />
      </div>
    )
  }

  if (!widget) {
    return (
      <div className={`${styles.dockablePanel} ${className || ''}`} data-widget-id={widgetId}>
        {!isInTabbedPanel && renderHeader()}
        {!bodyCollapsed && headerMiddle && (
          <div className={styles.headerMiddleRow}>{headerMiddle}</div>
        )}
        <div className={panelContentClass}>{children}</div>
      </div>
    )
  }

  return (
    <>
      <div
        className={`${styles.dockablePanel} ${className || ''} ${isDragging ? styles.dragging : ''} ${isInTabbedPanel ? styles.inTabbedPanel : ''} ${isCenterBottomCollapsed ? styles.collapsedAsTab : ''}`.trim()}
        data-widget-id={widgetId}
      >
        {!isInTabbedPanel && renderHeader()}
        {!bodyCollapsed && headerMiddle && (
          <div className={styles.headerMiddleRow}>{headerMiddle}</div>
        )}
        <div className={panelContentClass}>{children}</div>
      </div>

      {isDragging && (
        <div
          className={styles.dragPreview}
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
          }}
        >
          <div className={styles.dragPreviewContent}>
            <PanelHeader
              title={title}
              titleLeading={titleLeading}
              titleTrailing={titleTrailing}
              centerTitle={headerCenterTitle}
              titleFirst={headerTitleFirst}
              actions={headerActionsEl}
            />
            <div className={styles.dragPreviewBody}>{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
