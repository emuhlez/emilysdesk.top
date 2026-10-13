import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { MessagesSidebar } from './components/MessagesSidebar'
import { MessagesSidebarHeader } from './components/MessagesSidebarHeader'
import { MessagesToolbar } from './components/MessagesToolbar'
import { ConversationView } from './components/ConversationView'
import { LiquidGlassDefs } from '../photos/components/LiquidGlassDefs'
import { WINDOW_SHADOW } from '../../styles/window-shadow'
import { MESSAGES_WINDOW_BACKDROP, MESSAGES_WINDOW_TINT } from './constants'
import {
  MENU_BAR_H,
  DOCK_H,
  HANDLE,
  MOBILE_BREAKPOINT,
} from '../../constants/window-chrome'

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MIN_W = 560
const MIN_H = 400
const SIDEBAR_DEFAULT = 280
const SIDEBAR_MIN = 220
const SIDEBAR_MAX = 420

const TOOLBAR_H = 64
const SIDEBAR_FLOAT_INSET_LEFT = 10
const SIDEBAR_FLOAT_INSET_TOP = 10
const SIDEBAR_FLOAT_INSET_BOTTOM = 10
const SIDEBAR_FLOAT_GAP = 6

const SIDEBAR_ANIM_MS = 380
const SIDEBAR_ANIM_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

const CURSORS: Record<Dir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
}

function handleStyle(dir: Dir): React.CSSProperties {
  const h = HANDLE
  const base: React.CSSProperties = { position: 'absolute', cursor: CURSORS[dir] }
  switch (dir) {
    case 'n':
      return { ...base, top: -h / 2, left: h, right: h, height: h }
    case 's':
      return { ...base, bottom: -h / 2, left: h, right: h, height: h }
    case 'e':
      return { ...base, right: -h / 2, top: h, bottom: h, width: h }
    case 'w':
      return { ...base, left: -h / 2, top: h, bottom: h, width: h }
    case 'nw':
      return { ...base, top: -h / 2, left: -h / 2, width: h * 2, height: h * 2 }
    case 'ne':
      return { ...base, top: -h / 2, right: -h / 2, width: h * 2, height: h * 2 }
    case 'sw':
      return { ...base, bottom: -h / 2, left: -h / 2, width: h * 2, height: h * 2 }
    case 'se':
      return { ...base, bottom: -h / 2, right: -h / 2, width: h * 2, height: h * 2 }
  }
}

function clampMove(r: Rect): Rect {
  const vw = window.innerWidth
  let { x, y } = r
  const { w, h } = r
  if (y < MENU_BAR_H) y = MENU_BAR_H
  if (x < 0) x = 0
  if (x + w > vw) x = vw - w
  return { x, y, w, h }
}

function clampResize(r: Rect): Rect {
  const vw = window.innerWidth
  let { x, y, w, h } = r
  if (y < MENU_BAR_H) {
    const overflow = MENU_BAR_H - y
    y = MENU_BAR_H
    h = Math.max(MIN_H, h - overflow)
  }
  if (x < 0) x = 0
  if (x + w > vw) w = Math.max(MIN_W, vw - x)
  return { x, y, w, h }
}

function applyResize(start: Rect, dir: Dir, dx: number, dy: number): Rect {
  const next = { ...start }
  if (dir.includes('e')) next.w = Math.max(MIN_W, start.w + dx)
  if (dir.includes('w')) {
    const newW = Math.max(MIN_W, start.w - dx)
    next.x = start.x + (start.w - newW)
    next.w = newW
  }
  if (dir.includes('s')) next.h = Math.max(MIN_H, start.h + dy)
  if (dir === 'n' || dir === 'ne' || dir === 'nw') {
    const newH = Math.max(MIN_H, start.h - dy)
    next.y = start.y + (start.h - newH)
    next.h = newH
  }
  return clampResize(next)
}

const ALL_DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

export function MessagesWindow({
  onFocus,
  zIndex,
}: {
  onFocus: () => void
  zIndex: number
}) {
  const [rect, setRect] = useState<Rect>(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const isMobile = vw < MOBILE_BREAKPOINT
    const w = isMobile ? vw : Math.min(920, vw - 40)
    const h = isMobile
      ? vh - MENU_BAR_H - DOCK_H
      : Math.min(640, vh - MENU_BAR_H - DOCK_H - 40)
    const x = isMobile ? 0 : Math.round((vw - w) / 2)
    const y = MENU_BAR_H + (isMobile ? 0 : Math.round((vh - MENU_BAR_H - DOCK_H - h) / 2))
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)

  const closeApp = useAppStore((s) => s.closeApp)
  const setFullscreenApp = useAppStore((s) => s.setFullscreenApp)

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [fullscreen, setFullscreen] = useState(false)
  const [preFullscreenRect, setPreFullscreenRect] = useState<Rect | null>(null)

  useFitWindowToViewport(
    setRect,
    {
      menuBarH: MENU_BAR_H,
      dockH: DOCK_H,
      minW: MIN_W,
      minH: MIN_H,
      isFullscreen: () => fullscreen,
    },
    setPreFullscreenRect,
  )

  const windowRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    closeApp('messages')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])

  const { outerRef, handleMinimize } = useMinimizeAnimation(
    'messages',
    rectRef,
    windowRef,
    () => {
      if (fullscreen) {
        setFullscreen(false)
        setFullscreenApp(null)
      }
    },
  )

  const handleFullscreen = useCallback(() => {
    if (fullscreen) {
      if (preFullscreenRect) setRect(preFullscreenRect)
      setFullscreen(false)
      setFullscreenApp(null)
    } else {
      setPreFullscreenRect(rect)
      setRect({ x: 0, y: 0, w: window.innerWidth, h: window.innerHeight })
      setFullscreen(true)
      setFullscreenApp('messages')
    }
  }, [fullscreen, rect, preFullscreenRect, setFullscreenApp])

  const sidebarWidthRef = useRef(sidebarWidth)

  useLayoutEffect(() => {
    rectRef.current = rect
    sidebarWidthRef.current = sidebarWidth
  })

  const dragRef = useRef<{
    startX: number
    startY: number
    startRect: Rect
    mode: Dir | 'move'
  } | null>(null)

  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const [dragging, setDragging] = useState(false)
  const [sidebarDragging, setSidebarDragging] = useState(false)

  const startSidebarResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidthRef.current }
    setSidebarDragging(true)
  }, [])

  useEffect(() => {
    if (!sidebarDragging) return
    const onMove = (e: PointerEvent) => {
      if (!sidebarDragRef.current) return
      const dx = e.clientX - sidebarDragRef.current.startX
      setSidebarWidth(
        Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarDragRef.current.startWidth + dx)),
      )
    }
    const onUp = () => {
      sidebarDragRef.current = null
      setSidebarDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [sidebarDragging])

  const startDrag = useCallback(
    (mode: Dir | 'move', e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onFocus()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...rectRef.current },
        mode,
      }
      setDragging(true)
    },
    [onFocus],
  )

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const { startX, startY, startRect, mode } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (mode === 'move') {
        setRect(clampMove({ ...startRect, x: startRect.x + dx, y: startRect.y + dy }))
      } else {
        setRect(applyResize(startRect, mode, dx, dy))
      }
    }
    const onUp = () => {
      dragRef.current = null
      setDragging(false)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging])

  const contentLeftInset =
    SIDEBAR_FLOAT_INSET_LEFT + sidebarWidth + SIDEBAR_FLOAT_GAP

  return (
    <div
      ref={outerRef}
      className="absolute"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
        userSelect: dragging || sidebarDragging ? 'none' : undefined,
        transition:
          fullscreen || preFullscreenRect
            ? 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease'
            : undefined,
      }}
      onPointerDown={onFocus}
    >
      <div
        ref={windowRef}
        className="relative flex h-full w-full min-h-0 flex-col overflow-hidden"
        style={{
          borderRadius: fullscreen ? 0 : 24,
          background: MESSAGES_WINDOW_TINT,
          backdropFilter: MESSAGES_WINDOW_BACKDROP,
          WebkitBackdropFilter: MESSAGES_WINDOW_BACKDROP,
          boxShadow: fullscreen
            ? 'none'
            : `${WINDOW_SHADOW}, inset 0 0 0 0.5px rgba(255,255,255,0.12)`,
        }}
      >
        <LiquidGlassDefs />

        {/* Background extension (WWDC25-356): thread fills full width behind the
            inset Liquid Glass sidebar. Readable content is padded inside
            ConversationView — not by clipping the scroll view. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: 'transparent' }}>
          <ConversationView topInset={TOOLBAR_H} contentPadLeft={contentLeftInset} />
        </div>

        <div
          className="absolute"
          style={{
            left: SIDEBAR_FLOAT_INSET_LEFT,
            top: SIDEBAR_FLOAT_INSET_TOP,
            bottom: SIDEBAR_FLOAT_INSET_BOTTOM,
            width: sidebarWidth,
            zIndex: 16,
          }}
        >
          <MessagesSidebar
            width={sidebarWidth}
            topContentInset={TOOLBAR_H - SIDEBAR_FLOAT_INSET_TOP}
            onResizeStart={startSidebarResize}
          />
        </div>

        {/* Soft scroll-edge for floating toolbar (WWDC: soft default for Liquid
            Glass interactive elements; do not stack soft+hard on one view). */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: 0,
            left: contentLeftInset,
            right: 0,
            height: TOOLBAR_H,
            zIndex: 15,
            background:
              'linear-gradient(to bottom, rgba(22,22,22,0.55) 0%, rgba(22,22,22,0.28) 55%, rgba(22,22,22,0) 100%)',
            backdropFilter: 'blur(28px) saturate(160%)',
            WebkitBackdropFilter: 'blur(28px) saturate(160%)',
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 28px), rgba(0,0,0,0) 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 28px), rgba(0,0,0,0) 100%)',
            transition: `left ${SIDEBAR_ANIM_MS}ms ${SIDEBAR_ANIM_EASE}`,
          }}
        />

        <MessagesSidebarHeader
          onDragStart={(e) => startDrag('move', e)}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onFullscreen={handleFullscreen}
          sidebarWidth={sidebarWidth}
        />

        <MessagesToolbar
          height={TOOLBAR_H}
          onDragStart={(e) => startDrag('move', e)}
          contentLeftPx={contentLeftInset}
        />

        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: fullscreen ? 0 : 24,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
          }}
        />
      </div>

      {!fullscreen &&
        ALL_DIRS.map((dir) => (
          <div
            key={dir}
            style={{ ...handleStyle(dir), touchAction: 'none' }}
            onPointerDown={(e) => startDrag(dir, e)}
          />
        ))}
    </div>
  )
}
