import { useCallback, useEffect, useRef, useState } from 'react'
import { Wallpaper } from './Wallpaper'
import { Dock, DockIcon } from '../dock/Dock'
import { MenuBar } from '../menu-bar/MenuBar'
import resizeCursorUrl from '../../../assets/resize-cursor.png?url'
import trashIconUrl from '../../../dock icons/Trash.svg?url'
import { useAppStore } from '../../stores/app-store'
import { APP_REGISTRY, DOCK_ORDER } from '../../stores/app-registry'

const MIN_ICON_SIZE = 24
const MAX_ICON_SIZE = 64

function DockDivider({
  onSizeChange,
  iconSize,
}: {
  onSizeChange: (size: number) => void
  iconSize: number
}) {
  const dragRef = useRef<{ startY: number; startSize: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragRef.current = { startY: e.clientY, startSize: iconSize }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [iconSize],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return
      const delta = dragRef.current.startY - e.clientY // up = positive = bigger
      const newSize = Math.round(
        Math.min(MAX_ICON_SIZE, Math.max(MIN_ICON_SIZE, dragRef.current.startSize + delta)),
      )
      onSizeChange(newSize)
    },
    [onSizeChange],
  )

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current = null
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      className="-mx-2 flex shrink-0 flex-col px-3"
      style={{
        cursor: `url('${resizeCursorUrl}') 6 11, ns-resize`,
        touchAction: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="flex h-[var(--dock-icon-size)] items-center">
        <div className="h-full w-px rounded-full bg-white" />
      </div>
      <div style={{ height: 'calc(var(--dock-icon-size) / 7)' }} />
    </div>
  )
}

/**
 * Dock representation of a minimized window — *always* a window-shaped
 * thumbnail (34×24 rounded rect with a corner badge), never the running-app
 * icon. macOS Tahoe Photos.app's contract is: minimized things in the dock
 * read as miniature windows, regular dock icons read as app launchers, and
 * those two shapes don't get confused.
 *
 * Two render modes share that 34×24 footprint:
 *
 *  - **Captured** (`snapshot` truthy): the real `html-to-image` PNG of the
 *    window's last frame, with the app icon as a small bottom-right badge.
 *  - **Placeholder** (`snapshot` undefined): a dark gradient with the app
 *    icon centered. Used when capture failed (cross-origin canvas taint,
 *    backdrop-filter quirks, etc.). Without this branch the previous code
 *    fell back to a full-size DockIcon — which broke the "windows, not
 *    apps" contract by rendering minimized things as if they were
 *    launchable apps.
 */
function MinimizedSnapshot({
  snapshot,
  iconUrl,
  label,
  onClick,
}: {
  snapshot?: string
  iconUrl: string
  label: string
  onClick: () => void
}) {
  return (
    <div
      className="group relative flex shrink-0 flex-col items-center justify-center"
      onClick={onClick}
    >
      {/* Tooltip */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ marginBottom: 'calc(var(--dock-icon-size) / 6 + 12px)' }}
      >
        <div
          className="whitespace-nowrap rounded-xl px-3 py-1 text-white"
          style={{ fontSize: 13, background: 'rgba(70, 70, 70, 0.9)' }}
        >
          {label}
        </div>
        <svg className="mx-auto block" width="14" height="6" viewBox="0 0 14 6" fill="none">
          <path d="M0 0C2.5 0 4.5 2.1 5.8 4.1C6.3 4.8 7.7 4.8 8.2 4.1C9.5 2.1 11.5 0 14 0H0Z" fill="rgba(70, 70, 70, 0.85)" />
        </svg>
      </div>
      {/* Snapshot thumbnail – centered within dock-icon-size height */}
      <div
        className="flex items-center justify-center"
        style={{ height: 'var(--dock-icon-size)' }}
      >
        <div className="relative" style={{ width: 34, height: 24, cursor: 'pointer' }}>
          {/* Both branches share the EXACT same layout: a 34×24 main thumbnail
           *  + a 12×12 corner-badge app icon at bottom-right. The only thing
           *  that varies is whether the main area is the real captured PNG
           *  or a dark gradient fill. Keeping the badge in the same place
           *  means the dock reads as "Notes-style minimized window" for
           *  every app, regardless of capture success. */}
          {snapshot ? (
            <img
              src={snapshot}
              alt={label}
              draggable={false}
              style={{
                width: 34,
                height: 24,
                objectFit: 'cover',
                objectPosition: 'top left',
                borderRadius: 'calc(var(--dock-icon-size) / 8)',
                boxShadow:
                  '0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 0.5px rgba(255,255,255,0.12)',
              }}
            />
          ) : (
            <div
              style={{
                width: 34,
                height: 24,
                borderRadius: 'calc(var(--dock-icon-size) / 8)',
                background:
                  'linear-gradient(135deg, rgba(70, 70, 70, 0.78), rgba(34, 34, 34, 0.82))',
                boxShadow:
                  '0 2px 8px rgba(0,0,0,0.30), inset 0 0 0 0.5px rgba(255,255,255,0.14)',
              }}
            />
          )}
          {/* Corner-badge app icon — applies to both captured AND placeholder
           *  thumbnails so the layout is identical. The main thumbnail tells
           *  you which window; the badge tells you which app the window
           *  belongs to. Same convention macOS Tahoe's dock uses. */}
          <img
            src={iconUrl}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              bottom: -3,
              right: -3,
              width: 12,
              height: 12,
              borderRadius: 2,
              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
            }}
          />
        </div>
      </div>
      {/* Spacer to match dock icon height */}
      <div style={{ height: 'calc(var(--dock-icon-size) / 7)' }} />
    </div>
  )
}

export function Desktop() {
  const [dockIconSize, setDockIconSize] = useState(36)

  const focusedAppId = useAppStore((s) => s.focusedAppId)
  const openApps = useAppStore((s) => s.openApps)
  const minimizedApps = useAppStore((s) => s.minimizedApps)
  const minimizedSnapshots = useAppStore((s) => s.minimizedSnapshots)
  const fullscreenAppId = useAppStore((s) => s.fullscreenAppId)
  const windowOrder = useAppStore((s) => s.windowOrder)
  const focusApp = useAppStore((s) => s.focusApp)
  const unminimizeApp = useAppStore((s) => s.unminimizeApp)

  const openApp = useAppStore((s) => s.openApp)

  // Auto-open Notes on first visit
  useEffect(() => {
    const hasVisited = localStorage.getItem('has-visited')
    if (!hasVisited) {
      localStorage.setItem('has-visited', '1')
      openApp('notes')
    }
  }, [openApp])

  const focusedApp = APP_REGISTRY[focusedAppId] ?? APP_REGISTRY.finder
  const isFullscreen = fullscreenAppId !== null

  return (
    <div
      className="relative h-dvh w-screen overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      <Wallpaper />
      <MenuBar appName={focusedApp.name} menuItems={focusedApp.menuItems} fullscreen={isFullscreen} />

      {/* Desktop surface */}
      <main className="relative h-full w-full">
        {windowOrder.map((appId) => {
          if (!openApps.has(appId) || minimizedApps.has(appId)) return null
          const app = APP_REGISTRY[appId]
          if (!app?.windowComponent) return null
          const WindowComponent = app.windowComponent
          const zIndex = appId === fullscreenAppId ? 40 : windowOrder.indexOf(appId) + 1
          return (
            <WindowComponent
              key={appId}
              onFocus={() => focusApp(appId)}
              zIndex={zIndex}
            />
          )
        })}
      </main>

      {!isFullscreen && (
        <Dock iconSize={dockIconSize}>
          {DOCK_ORDER.map((appId) => {
            const app = APP_REGISTRY[appId]
            return (
              <DockIcon
                key={appId}
                src={app.iconUrl}
                label={app.name}
                appId={appId}
              />
            )
          })}
          <DockDivider onSizeChange={setDockIconSize} iconSize={dockIconSize} />
          {/* Invisible anchor for the genie minimize animation. It's a 0-width
           *  flex sibling, which means the dock's `gap` would otherwise insert
           *  an extra full gap between the divider and whatever follows
           *  (trash, or the first minimized snapshot). That made the trash
           *  sit ~one-gap further from the divider line than the leftmost app
           *  sits on the other side — visibly asymmetric. The negative
           *  margin-left, sized to the exact same `gap` formula used by
           *  <DockBackground>, cancels that extra gap so the divider's
           *  surroundings stay symmetric whether or not minimized windows
           *  exist. */}
          <div
            data-genie-target
            style={{
              height: 'var(--dock-icon-size)',
              width: 0,
              marginLeft: 'calc(var(--dock-icon-size) * -8 / 36)',
            }}
          />
          {/* Minimized-windows region of the dock: ALWAYS render
           *  <MinimizedSnapshot>, never <DockIcon>. The `snapshot` prop is
           *  optional — when capture succeeded it shows the real PNG, when
           *  capture failed (cross-origin canvas taint, etc.) it shows a
           *  window-shaped placeholder. The previous code fell back to
           *  <DockIcon> here, which violated the "windows, not apps" rule
           *  by rendering full-size launchable-looking app icons in the
           *  minimized region of the dock. */}
          {Array.from(minimizedApps).map((appId) => {
            const app = APP_REGISTRY[appId]
            if (!app) return null
            return (
              <MinimizedSnapshot
                key={`minimized-${appId}`}
                snapshot={minimizedSnapshots.get(appId)}
                iconUrl={app.iconUrl}
                label={app.name}
                onClick={() => unminimizeApp(appId)}
              />
            )
          })}
          <DockIcon src={trashIconUrl} label="Trash" />
        </Dock>
      )}
    </div>
  )
}
