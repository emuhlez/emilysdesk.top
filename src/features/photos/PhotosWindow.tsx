import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { PhotosSidebar } from './components/PhotosSidebar'
import {
  COLLAPSED_HEADER_ZONE_WIDTH,
  PhotosSidebarHeader,
} from './components/PhotosSidebarHeader'
import { PhotosToolbar } from './components/PhotosToolbar'
import { PhotosGrid } from './components/PhotosGrid'
import { LiquidGlassDefs } from './components/LiquidGlassDefs'
import { WINDOW_SHADOW } from '../../styles/window-shadow'
import { MENU_BAR_H, DOCK_H, HANDLE } from '../../constants/window-chrome'

const TOOLBAR_H = 64

/* ─── resize types ─── */

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Per-app floors stay local — Photos needs ~560x420 to keep grid + sidebar usable.
const MIN_W = 560
const MIN_H = 420
const SIDEBAR_DEFAULT = 205
const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 360

const SIDEBAR_FLOAT_INSET_LEFT = 10
const SIDEBAR_FLOAT_INSET_TOP = 10
const SIDEBAR_FLOAT_INSET_BOTTOM = 10
const SIDEBAR_FLOAT_GAP = 6

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

export function PhotosWindow({
  onFocus,
  zIndex,
}: {
  onFocus: () => void
  zIndex: number
}) {
  const [rect, setRect] = useState<Rect>(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.min(960, vw - 40)
    const h = Math.min(640, vh - MENU_BAR_H - DOCK_H - 40)
    const x = Math.round((vw - w) / 2)
    const y = MENU_BAR_H + Math.round((vh - MENU_BAR_H - DOCK_H - h) / 2)
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)
  useEffect(() => {
    rectRef.current = rect
  })

  const closeApp = useAppStore((s) => s.closeApp)
  const setFullscreenApp = useAppStore((s) => s.setFullscreenApp)

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [fullscreen, setFullscreen] = useState(false)
  const [preFullscreenRect, setPreFullscreenRect] = useState<Rect | null>(null)

  /* Proportionally fit the window to the browser viewport: as the browser
     grows/shrinks, the window scales by the same ratio so its share of the
     viewport stays roughly constant (instead of just clamping downward).
     Skip scaling while fullscreen — the hook snaps the rect to the full
     viewport instead so chrome stays glued to the screen edges. */
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
    closeApp('photos')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])

  const { outerRef, handleMinimize } = useMinimizeAnimation(
    'photos',
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
      setFullscreenApp('photos')
    }
  }, [fullscreen, rect, preFullscreenRect, setFullscreenApp])

  /* ── drag & resize ── */

  const sidebarWidthRef = useRef(sidebarWidth)
  useEffect(() => {
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

  const effectiveSidebarWidth = sidebarCollapsed ? 0 : sidebarWidth

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
          /* Option A: subtle translucency so sidebar backdrop-filter samples real content behind the window (sim desktop wallpaper). */
          background: fullscreen ? '#1E1E1E' : 'rgba(30, 30, 30, 0.92)',
          boxShadow: fullscreen ? 'none' : WINDOW_SHADOW,
        }}
      >
        <LiquidGlassDefs />

        {/* Photo grid spans the full window width and full height; the floating sidebar
            sits on top of it on the left, and the toolbar's frosted-glass zone floats
            over the top so scrolling photos pass *behind* the toolbar rather than being
            clipped by it. The grid's first row is inset by TOOLBAR_H via topInset. */}
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          style={{
            paddingLeft:
              effectiveSidebarWidth > 0
                ? SIDEBAR_FLOAT_INSET_LEFT + effectiveSidebarWidth + SIDEBAR_FLOAT_GAP
                : 0,
            transition: 'padding-left 280ms cubic-bezier(0.32, 0.72, 0, 1)',
            background: 'transparent',
          }}
        >
          <PhotosGrid topInset={TOOLBAR_H} />
        </div>

        {effectiveSidebarWidth > 0 && (
          <div
            className="absolute"
            style={{
              left: SIDEBAR_FLOAT_INSET_LEFT,
              top: SIDEBAR_FLOAT_INSET_TOP,
              bottom: SIDEBAR_FLOAT_INSET_BOTTOM,
              width: effectiveSidebarWidth,
              transition: 'width 280ms cubic-bezier(0.32, 0.72, 0, 1)',
              // z-16 sits one notch above the frost top bar (z-15) so that
              // during the collapse→expand slide — where the sidebar mounts
              // instantly at full width but the frost's `left` animates over
              // 280 ms toward the sidebar's right edge — the sidebar's top
              // is not transiently tinted by the frost's backdrop blur. In
              // the resting expanded state the two never overlap (frost
              // starts at sidebar.right + 6 px), so this only matters
              // during the slide.
              zIndex: 16,
            }}
          >
            <PhotosSidebar
              width={effectiveSidebarWidth}
              topContentInset={TOOLBAR_H - SIDEBAR_FLOAT_INSET_TOP}
              onResizeStart={startSidebarResize}
            />
          </div>
        )}

        {/* Frosted top backing strip. Anchors the toolbar's chip clusters on
            a continuous translucent band so they don't read as floating on
            photo content. Left edge animates in sync with the sidebar slide
            (280 ms cubic-bezier 0.32, 0.72, 0, 1) — full-width when
            collapsed, starts at the sidebar's right edge when expanded.
            All three free edges (bottom, left, right) dissolve via long
            non-linear mask-image gradients so the band feels seamless
            with no perceptible hairline. The bottom fade uses a 2-stop
            curve (gentle 1.0 → 0.7 over 20 px, then accelerated 0.7 → 0
            over 12 px) so the eye-sensitive midtones change slowly while
            the high-contrast endpoints change fast — same trick as macOS
            Tahoe's toolbar bottom edge. Left + right edges mirror the
            curve so the band tapers symmetrically. */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: 0,
            left:
              effectiveSidebarWidth > 0
                ? SIDEBAR_FLOAT_INSET_LEFT + effectiveSidebarWidth + SIDEBAR_FLOAT_GAP
                : 0,
            right: 0,
            height: TOOLBAR_H,
            zIndex: 15,
            background: 'rgba(28, 28, 30, 0.50)',
            backdropFilter: 'blur(30px) saturate(160%)',
            WebkitBackdropFilter: 'blur(30px) saturate(160%)',
            boxShadow: 'inset 0 0.5px 0 rgba(255, 255, 255, 0.10)',
            maskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 32px), rgba(0,0,0,0.7) calc(100% - 12px), rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 12px, rgba(0,0,0,1) 32px, rgba(0,0,0,1) 100%), linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 12px, rgba(0,0,0,1) 32px, rgba(0,0,0,1) 100%)',
            maskComposite: 'intersect',
            WebkitMaskImage:
              'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) calc(100% - 32px), rgba(0,0,0,0.7) calc(100% - 12px), rgba(0,0,0,0) 100%), linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 12px, rgba(0,0,0,1) 32px, rgba(0,0,0,1) 100%), linear-gradient(to left, rgba(0,0,0,0) 0%, rgba(0,0,0,0.7) 12px, rgba(0,0,0,1) 32px, rgba(0,0,0,1) 100%)',
            WebkitMaskComposite: 'source-in',
            transition: 'left 280ms cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />

        <PhotosSidebarHeader
          onDragStart={(e) => startDrag('move', e)}
          onClose={handleClose}
          onMinimize={handleMinimize}
          onFullscreen={handleFullscreen}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          sidebarWidth={effectiveSidebarWidth}
        />

        <PhotosToolbar
          height={TOOLBAR_H}
          onDragStart={(e) => startDrag('move', e)}
          contentLeftPx={
            effectiveSidebarWidth > 0
              ? SIDEBAR_FLOAT_INSET_LEFT + effectiveSidebarWidth + SIDEBAR_FLOAT_GAP
              : COLLAPSED_HEADER_ZONE_WIDTH
          }
          windowWidth={rect.w}
        />

        {/* Inner border overlay. Mirrors NotesWindow's chrome rim so the
         *  two windows read as the same surface — a single soft 1 px
         *  inset stroke at 0.22 white, sitting just inside the rounded
         *  corner. Replaces the previous Photos-only two-stop recipe
         *  (`0.14` top highlight + `0.06` full rim) which was meaningfully
         *  more recessed than Notes; aligning them keeps window chrome
         *  consistent across the two apps as both use the WINDOW_SHADOW
         *  outer glow to do the heavy lifting on edge definition. */}
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
