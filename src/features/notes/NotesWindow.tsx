import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { NotesSidebar } from './components/NotesSidebar'
import { NotesToolbar } from './components/NotesToolbar'
import { NotesEditor } from './components/NotesEditor'
import { WINDOW_SHADOW } from '../../styles/window-shadow'
import {
  MENU_BAR_H,
  DOCK_H,
  HANDLE,
  MOBILE_BREAKPOINT,
} from '../../constants/window-chrome'

/* ─── resize types ─── */

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Per-app floors stay local — Notes needs ~300x400 for the editor column.
const MIN_W = 300
const MIN_H = 400
const SIDEBAR_DEFAULT = 260
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 400

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

/* ─── window ─── */

export function NotesWindow({
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
    const w = isMobile ? vw : Math.min(900, vw - 40)
    const h = isMobile
      ? vh - MENU_BAR_H - DOCK_H
      : Math.min(620, vh - MENU_BAR_H - DOCK_H - 40)
    const x = isMobile ? 0 : Math.round((vw - w) / 2)
    const y = MENU_BAR_H + (isMobile ? 0 : Math.round((vh - MENU_BAR_H - DOCK_H - h) / 2))
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)

  const closeApp = useAppStore((s) => s.closeApp)
  const setFullscreenApp = useAppStore((s) => s.setFullscreenApp)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [fullscreen, setFullscreen] = useState(false)
  const [preFullscreenRect, setPreFullscreenRect] = useState<Rect | null>(null)

  /* Proportionally fit the window to the browser viewport: as the browser
     grows/shrinks, the window scales by the same ratio so its share of the
     viewport stays roughly constant (instead of just clamping downward). */
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

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), [])

  const windowRef = useRef<HTMLDivElement>(null)

  const handleClose = useCallback(() => {
    closeApp('notes')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])

  const { outerRef, handleMinimize } = useMinimizeAnimation(
    'notes',
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
      setFullscreenApp('notes')
    }
  }, [fullscreen, rect, preFullscreenRect, setFullscreenApp])

  /* ── drag & resize ── */

  const sidebarWidthRef = useRef(sidebarWidth)

  // Mirror latest rect + sidebar width into refs for post-commit drag
  // handlers without stale closures. Layout-effect write (not during
  // render) keeps react-hooks/refs happy while leaving the useRefs
  // visible to the React Compiler as stable deps.
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
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarDragRef.current.startWidth + dx)))
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
      {/* Window chrome */}
      <div
        ref={windowRef}
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{
          borderRadius: fullscreen ? 0 : 24,
          background: '#1E1E1E',
          boxShadow: fullscreen ? 'none' : WINDOW_SHADOW,
        }}
      >
        {/* Unified top bar */}
        <NotesToolbar
          onToggleSidebar={toggleSidebar}
          onDragStart={(e) => startDrag('move', e)}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onFullscreen={handleFullscreen}
          windowWidth={rect.w}
        />

        {/* Body: sidebar + editor */}
        <div className="flex min-h-0 flex-1">
          {/* Sidebar */}
          <div
            className="shrink-0 overflow-hidden transition-[margin] duration-300 ease-in-out"
            style={{ marginLeft: sidebarCollapsed ? -sidebarWidth : 0 }}
          >
            <NotesSidebar
              width={sidebarWidth}
              onResizeStart={startSidebarResize}
            />
          </div>

          {/* Editor area */}
          <div className="flex min-w-0 flex-1 flex-col" style={{ background: '#1E1E1E' }}>
            <NotesEditor />
          </div>
        </div>

        {/* Inner border overlay. Sits 1 px inside the window's rounded
         *  rect to give the chrome a defined edge against the wallpaper
         *  behind it. Opacity backed off from 0.35 → 0.22 — at 0.35 the
         *  rim read as a hairline rather than a soft chrome edge, which
         *  fought with the WINDOW_SHADOW outer glow on light wallpapers.
         *  0.22 keeps the edge legible on the dark window fill (#1E1E1E)
         *  while letting the outer shadow do most of the "where the
         *  window stops" work, matching macOS Tahoe's softer chrome rim. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: fullscreen ? 0 : 24,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
          }}
        />
      </div>

      {/* Resize handles */}
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
