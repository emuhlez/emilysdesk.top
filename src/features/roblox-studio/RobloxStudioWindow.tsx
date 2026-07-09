import { useCallback, useEffect, useRef, useState } from 'react'
import { TrafficLights } from '../../components/TrafficLights'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { WINDOW_SHADOW } from '../../styles/window-shadow'

/* ─── resize types ─── */

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const MENU_BAR_H = 28
const DOCK_H = 70
// studio-shell's editor (toolbar + five dock zones) is dense — anything
// smaller than ~1024×640 and the inspector / hierarchy panels clip badly.
const MIN_W = 1024
const MIN_H = 640
const HANDLE = 6
const TITLEBAR_H = 36
const MOBILE_BREAKPOINT = 640

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

/* ─── studio-shell URL ──────────────────────────────────────────────────
 *
 *  The Roblox Studio "app" inside this desktop is a live iframe of the
 *  studio-shell subproject that lives in this repo at ./studio-shell/
 *  (imported via `git subtree --squash`; deploys as its own Vercel
 *  project). In dev that means pointing this window at studio-shell's
 *  Vite dev server (port 3000 by default — see
 *  studio-shell/vite.config.ts). Boot both from the repo root with
 *  `npm run dev:all` and every save inside ./studio-shell/ hot-reloads
 *  inside this window with no host rebuild — true live mirror.
 *
 *  For prod / preview deploys, set VITE_STUDIO_SHELL_URL at build time
 *  to studio-shell's hosted URL (the second Vercel project pointed at
 *  ./studio-shell/). The "mirror forever" behavior in prod comes from
 *  the host iframing that stable URL — redeploy studio-shell and the
 *  in-shell app updates automatically, no host redeploy needed.
 *  Defaults to localhost:3000 so a fresh clone "just works" in dev.
 *
 *  Note: this is intentionally a CROSS-ORIGIN iframe (localhost:5180 ↔
 *  localhost:3000 in dev, host-vercel ↔ studio-shell-vercel in prod),
 *  which means:
 *    - html-to-image can't paint a real minimize thumbnail of its
 *      contents — Desktop.tsx's MinimizedSnapshot already falls back to
 *      the dark placeholder + corner-badge for that case, so this
 *      degrades gracefully instead of breaking.
 *    - studio-shell's heavy global CSS (BuilderSans, `:root` vars,
 *      `body { overflow: hidden }`) stays scoped to its own document
 *      and can't leak into the macOS chrome — which is exactly why we
 *      iframe instead of vendoring (see system-architect proposal). */
const STUDIO_SHELL_URL =
  (import.meta.env.VITE_STUDIO_SHELL_URL as string | undefined) ?? 'http://localhost:3000'

/* Detect Electron via the preload-exposed flag, same convention ArcWindow
 * uses. In Electron we render <webview> instead of <iframe> — webviews
 * give us native back/forward, isolated session storage, and don't carry
 * the cross-origin iframe sandboxing constraints. */
const isElectron =
  typeof window !== 'undefined' &&
  ((window as unknown as { isElectronApp?: boolean }).isElectronApp === true ||
    (typeof (window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions?.electron === 'string'))

/* ─── window ─── */

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
    const availH = vh - MENU_BAR_H - DOCK_H
    const isMobile = vw < MOBILE_BREAKPOINT
    // 20px breathing room on each side matches Notes/Photos. The initial w/h
    // intentionally do NOT clamp up to MIN_W/MIN_H — siblings (Arc, Notes,
    // Photos) all let the *initial* rect be smaller than the min on narrow
    // viewports, which keeps the window visibly inset from the desktop edges
    // even at e.g. 1024px wide. MIN_W/MIN_H still kick in when the user
    // resizes via clampResize / applyResize, so the floor is enforced once
    // the user is actively dragging an edge.
    const margin = isMobile ? 0 : 20
    const w = isMobile ? vw : Math.min(1280, vw - margin * 2)
    const h = isMobile ? availH : Math.min(800, availH - margin * 2)
    const x = isMobile ? 0 : Math.round((vw - w) / 2)
    const y = MENU_BAR_H + (isMobile ? 0 : margin + Math.round((availH - margin * 2 - h) / 2))
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)
  rectRef.current = rect

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

  const handleClose = useCallback(() => {
    closeApp('roblox-studio')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])

  const windowRef = useRef<HTMLDivElement>(null)

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
          background: '#121215',
          boxShadow: fullscreen ? 'none' : WINDOW_SHADOW,
        }}
      >
        {/* Titlebar — minimal because studio-shell paints its own toolbar
         *  underneath. We just need a drag handle + traffic lights.
         *
         *  Background is one step lighter than the iframe fill (#202227 vs
         *  #121215) — matches studio-shell's `--bg-surface200` token and the
         *  macOS Tahoe focused-window chrome color. The 1 px tonal seam
         *  between the titlebar and studio-shell's own top toolbar is
         *  intentional: it reads as a real chrome → content boundary the
         *  same way a native Roblox Studio.app titlebar does, rather than
         *  the prior "single continuous black surface" treatment.
         *
         *  Traffic-light inset = 20 px (pl-5), matching
         *  PhotosSidebarHeader's `TRAFFIC_LEFT_INSET` and the macOS
         *  canonical position. Right padding kept tight (pr-3) because
         *  nothing lives on the right side of this titlebar — the centered
         *  title is absolutely positioned, not part of the flex flow. */}
        <div
          className="relative flex shrink-0 items-center pl-5 pr-3"
          style={{
            height: TITLEBAR_H,
            background: '#202227',
            cursor: 'default',
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) startDrag('move', e)
          }}
          onDoubleClick={handleFullscreen}
        >
          <TrafficLights
            onClose={handleClose}
            onMinimize={handleMinimize}
            onFullscreen={handleFullscreen}
          />
          {/* Centered window title — pointer-events-none so it doesn't
           *  steal drags from the titlebar. */}
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12px] font-medium"
            style={{ color: 'rgba(255, 255, 255, 0.55)' }}
          >
            Roblox Studio
          </div>
        </div>

        {/* Embedded studio-shell — fills the remaining content area.
         *  data-skip-snapshot keeps html-to-image from even trying to
         *  paint the cross-origin iframe during minimize capture (it
         *  would throw SecurityError mid-capture and abort the whole
         *  thumbnail). The window chrome above still captures, so the
         *  dock thumb reads as the actual Roblox Studio window outline
         *  instead of a blank rectangle. */}
        <div
          className="relative min-h-0 flex-1 overflow-hidden"
          style={{ background: '#121215' }}
        >
          {/* Pointer-events shield: while the user is dragging the
           *  window edge / titlebar / a resize handle, swallow pointer
           *  events on the iframe so the drag doesn't get hijacked by
           *  studio-shell's own pointer handlers (its hierarchy panel,
           *  viewport, etc. all capture aggressively). */}
          {isElectron ? (
            <webview
              src={STUDIO_SHELL_URL}
              data-skip-snapshot
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: dragging ? 'none' : 'auto',
              }}
            />
          ) : (
            <iframe
              src={STUDIO_SHELL_URL}
              title="Roblox Studio"
              data-skip-snapshot
              allow="clipboard-read; clipboard-write; fullscreen"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                border: 'none',
                pointerEvents: dragging ? 'none' : 'auto',
              }}
            />
          )}
        </div>

        {/* Inner border overlay. Mirrors NotesWindow / PhotosWindow's chrome
         *  rim so all three windows read as the same surface — a single soft
         *  1 px inset stroke at 0.22 white, sitting just inside the rounded
         *  corner. Sits on top of the iframe so the rim is visible against
         *  studio-shell's dark fill instead of being clipped by overflow. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: fullscreen ? 0 : 24,
            boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.22)',
          }}
        />
      </div>

      {/* Resize handles */}
      {ALL_DIRS.map((dir) => (
        <div
          key={dir}
          style={{ ...handleStyle(dir), touchAction: 'none' }}
          onPointerDown={(e) => startDrag(dir, e)}
        />
      ))}
    </div>
  )
}
