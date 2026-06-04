import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { TrafficLights } from '../../components/TrafficLights'
import { WINDOW_SHADOW } from '../../styles/window-shadow'
import { WINDOW_TITLE_STYLE } from '../../styles/typography'
import {
  MENU_BAR_H,
  DOCK_H,
  HANDLE,
  MOBILE_BREAKPOINT,
  TITLE_BAR_BG,
} from '../../constants/window-chrome'

/**
 * Roblox Studio window — iframes the deployed studio-shell mockup at
 * `https://studio-shell.vercel.app/`. We own the macOS chrome (traffic
 * lights, drag/resize, minimize/fullscreen) and the studio mockup
 * lives entirely inside the iframe.
 *
 * The drag/resize boilerplate is structurally identical to
 * `NotesWindow.tsx` — same Rect/Dir model, same clamp & resize helpers,
 * same `useMinimizeAnimation` + `useFitWindowToViewport` wiring. If you
 * change one, change the other (or extract into a shared hook).
 *
 * IFRAME GOTCHAS:
 *  - `data-skip-snapshot` on the iframe tells `useMinimizeAnimation`'s
 *    html-to-image filter to skip it. Without that flag, cross-origin
 *    iframes throw SecurityError during the snapshot pass and abort the
 *    whole dock-thumbnail capture.
 *  - While dragging/resizing the window, we set `pointerEvents: 'none'`
 *    on the iframe so the iframe doesn't swallow the pointermove events
 *    when the cursor crosses over it mid-drag.
 *  - The studio-shell deployment must NOT send
 *    `X-Frame-Options: DENY` or `Content-Security-Policy:
 *    frame-ancestors 'none'` headers, or the iframe will refuse to
 *    load. If that ever happens, route through `/api/iframe-check` the
 *    same way `ArcWindow` does.
 */
const STUDIO_URL = 'https://studio-shell.vercel.app/'

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MIN_W = 720
const MIN_H = 480

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

export function RobloxStudioWindow({
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
    const w = isMobile ? vw : Math.min(1180, vw - 40)
    const h = isMobile
      ? vh - MENU_BAR_H - DOCK_H
      : Math.min(740, vh - MENU_BAR_H - DOCK_H - 40)
    const x = isMobile ? 0 : Math.round((vw - w) / 2)
    const y = MENU_BAR_H + (isMobile ? 0 : Math.round((vh - MENU_BAR_H - DOCK_H - h) / 2))
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)

  // Mirror the latest rect into a ref for the drag handlers. Layout-effect
  // write (not during render) satisfies react-hooks/refs while keeping the
  // useRef visible to the React Compiler as a stable dep.
  useLayoutEffect(() => {
    rectRef.current = rect
  })

  const closeApp = useAppStore((s) => s.closeApp)
  const setFullscreenApp = useAppStore((s) => s.setFullscreenApp)

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
    closeApp('roblox-studio')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])

  const { outerRef, handleMinimize } = useMinimizeAnimation(
    'roblox-studio',
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
      setFullscreenApp('roblox-studio')
    }
  }, [fullscreen, rect, preFullscreenRect, setFullscreenApp])

  const dragRef = useRef<{
    startX: number
    startY: number
    startRect: Rect
    mode: Dir | 'move'
  } | null>(null)

  const [dragging, setDragging] = useState(false)

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
        userSelect: dragging ? 'none' : undefined,
        transition:
          fullscreen || preFullscreenRect
            ? 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease'
            : undefined,
      }}
      onPointerDown={onFocus}
    >
      <div
        ref={windowRef}
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{
          borderRadius: fullscreen ? 0 : 24,
          background: '#1E1E1E',
          boxShadow: fullscreen ? 'none' : WINDOW_SHADOW,
        }}
      >
        {/* macOS title bar — minimal because the studio-shell iframe
         *  paints its own ribbon / toolbars right below. We only own
         *  the traffic lights, the centered title, and the drag
         *  handle.
         *
         *  macOS Tahoe title bar styling:
         *   - Shared opaque dark-window tone (`TITLE_BAR_BG`, #222222),
         *     the same flat fill Notes uses, over the #1E1E1E body.
         *   - 36px tall — sits between the compact (28px) and standard
         *     (40px) Tahoe title-bar heights, giving the title room to
         *     breathe without feeling un-Mac.
         *   - Traffic lights inset 20px from the left so they visually
         *     balance against the 24px window corner radius (lights
         *     sitting too close to the curve looked cramped). Right
         *     padding stays at 18px for visual balance on the title
         *     side, with a 16px gap between the lights and the
         *     title. */}
        <div
          className="relative flex shrink-0 items-center"
          style={{
            height: 36,
            paddingLeft: 20,
            paddingRight: 18,
            background: TITLE_BAR_BG,
            cursor: 'default',
            touchAction: 'none',
            fontSize: 14,
          }}
          onPointerDown={(e) => startDrag('move', e)}
          onDoubleClick={handleFullscreen}
        >
          <div onPointerDown={(e) => e.stopPropagation()}>
            <TrafficLights
              onClose={handleClose}
              onMinimize={handleMinimize}
              onFullscreen={handleFullscreen}
            />
          </div>
          {/* Left-aligned title — sits next to the traffic lights with a
           *  16px gap. Uses the shared `WINDOW_TITLE_STYLE` (13/600,
           *  near-white) so it matches Notes/Photos exactly.
           *  `pointer-events: none` so it doesn't eat the drag handler
           *  on the title bar. */}
          <div className="pointer-events-none" style={{ ...WINDOW_TITLE_STYLE, marginLeft: 16 }}>
            Roblox Studio
          </div>
        </div>

        {/* Iframe body. `pointerEvents: none` while dragging so cross-
         *  iframe pointermoves don't get swallowed mid-drag (otherwise
         *  the window "sticks" the moment the cursor enters the
         *  iframe). `data-skip-snapshot` excludes this from the dock
         *  minimize thumbnail capture. */}
        <iframe
          src={STUDIO_URL}
          title="Roblox Studio"
          data-skip-snapshot
          style={{
            flex: 1,
            width: '100%',
            border: 0,
            background: '#1E1E1E',
            pointerEvents: dragging ? 'none' : 'auto',
            display: 'block',
          }}
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
