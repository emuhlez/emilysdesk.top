import type { PointerEvent as ReactPointerEvent } from 'react'
import { TrafficLights } from '../../../components/TrafficLights'
import filterSvg from '../../../../assets/sf-symbols/line.3.horizontal.decrease--monochrome--medium.svg?raw'

const TOOLBAR_H = 64
const TRAFFIC_LIGHT_DOT = 12
const TRAFFIC_LIGHT_GAP = 8
const TRAFFIC_LEFT_INSET = 20
/** Bare filter glyph hit target (no circular chip). */
const FILTER_HIT = 28
const SIDEBAR_LEFT_INSET = 10
/** Inset from the glass tile's right edge — matches MessagesSidebar content pad. */
const SIDEBAR_RIGHT_INSET = 12

/**
 * Sidebar-zone chrome for Messages — traffic lights on the left, bare SF Symbol
 * filter (`line.3.horizontal.decrease`) pinned to the far-right of the glass
 * tile. Filter is a stub for a future conversation-filter menu — it does not
 * collapse the sidebar.
 */
export function MessagesSidebarHeader({
  onDragStart,
  onClose,
  onMinimize,
  onFullscreen,
  sidebarWidth,
}: {
  onDragStart: (e: ReactPointerEvent) => void
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
  sidebarWidth: number
}) {
  const zoneWidth = SIDEBAR_LEFT_INSET + sidebarWidth

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-30 flex items-center"
      style={{
        width: zoneWidth,
        height: TOOLBAR_H,
        cursor: 'default',
      }}
    >
      <div
        className="absolute inset-0"
        style={{ zIndex: 0, pointerEvents: 'auto' }}
        onPointerDown={onDragStart}
      />

      <div
        className="pointer-events-none relative z-[1] flex h-full w-full min-w-0 items-center"
        style={{
          paddingLeft: TRAFFIC_LEFT_INSET,
          paddingRight: SIDEBAR_RIGHT_INSET,
        }}
      >
        <div
          className="pointer-events-auto flex items-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <TrafficLights
            onClose={onClose}
            onMinimize={onMinimize}
            onFullscreen={onFullscreen}
            dotSize={TRAFFIC_LIGHT_DOT}
            gapPx={TRAFFIC_LIGHT_GAP}
          />
        </div>

        <div
          className="pointer-events-auto ml-auto flex shrink-0 items-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div
            role="button"
            aria-label="Filter"
            aria-disabled="true"
            title="Filter — coming soon"
            className="flex items-center justify-center"
            style={{
              cursor: 'default',
              width: FILTER_HIT,
              height: FILTER_HIT,
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <span
              className="inline-flex shrink-0 [&>svg]:block"
              style={{ width: 18, height: 18 }}
              dangerouslySetInnerHTML={{ __html: filterSvg }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
