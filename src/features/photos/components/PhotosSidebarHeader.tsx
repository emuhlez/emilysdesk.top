import type { PointerEvent as ReactPointerEvent } from 'react'
import { TrafficLights } from '../../../components/TrafficLights'
import sidebarLeftMediumSvg from '../../../../assets/sf-symbols/sidebar.left--monochrome--medium.svg?raw'

/**
 * PhotosSidebarHeader
 *
 * Owns the chrome that visually belongs to the sidebar zone of the Photos window:
 * the traffic lights and the sidebar-toggle button. Decoupled from PhotosToolbar so
 * the two regions (sidebar header vs. content header) can be positioned, styled, and
 * dragged independently.
 *
 * Positioned absolutely at the top-left of the window. When the sidebar is visible,
 * the toggle button hugs the sidebar's inner-right edge; when collapsed, the toggle
 * floats just after the traffic lights as a standalone glass chip.
 */

const TOOLBAR_H = 64
const TRAFFIC_LIGHT_DOT = 12
const TRAFFIC_LIGHT_GAP = 8
const TRAFFIC_LEFT_INSET = 20
/** Width of the traffic-lights cluster: 3 dots + 2 inter-dot gaps. */
const TRAFFIC_BLOCK_WIDTH = TRAFFIC_LIGHT_DOT * 3 + TRAFFIC_LIGHT_GAP * 2
/** X position immediately after the traffic-lights cluster. */
const TRAFFIC_BLOCK_END = TRAFFIC_LEFT_INSET + TRAFFIC_BLOCK_WIDTH

/** Width of the sidebar-toggle chip (Notes-style 38 × 36 pill — see the
 *  toggle's JSX comment for the visual rationale). Used to (a) right-anchor
 *  the toggle inside the sidebar with SIDEBAR_RIGHT_INSET breathing room
 *  when the sidebar is open, and (b) compute the collapsed-state header
 *  zone width below. Keep in sync with the toggle's `width` prop. */
const TOGGLE_CLUSTER_WIDTH = 38
const SIDEBAR_LEFT_INSET = 10
const SIDEBAR_RIGHT_INSET = 2
/** Static gap between traffic-lights cluster and the toggle chip (and to the
 *  right of the toggle chip) when the sidebar is collapsed. */
const COLLAPSED_TOGGLE_GAP = 8

/**
 * Width of the sidebar-header zone (traffic lights + sidebar-toggle chip)
 * when the sidebar is collapsed. Re-used by `PhotosWindow` to push the
 * toolbar's title plate past this zone, so the `Library` title sits to the
 * right of the toggle chip instead of underneath it.
 */
export const COLLAPSED_HEADER_ZONE_WIDTH =
  TRAFFIC_BLOCK_END + COLLAPSED_TOGGLE_GAP + TOGGLE_CLUSTER_WIDTH + COLLAPSED_TOGGLE_GAP

/* GlassCluster / GlassButton / SingleClusterHoverContext used to live here
 * — local copies of the same primitives in PhotosToolbar — to wrap the
 * sidebar-toggle chip in a Tahoe Liquid Glass capsule. They were removed
 * when the toggle was rebuilt to match Notes' chrome chip pixel-for-pixel
 * (see the JSX comment on the toggle below for the rationale). The
 * primitives still exist in PhotosToolbar for the toolbar's multi-button
 * clusters; if a future control in this file needs a glass cluster again,
 * pull from there (or the eventual shared primitive) rather than
 * resurrecting a parallel copy. */

export function PhotosSidebarHeader({
  onDragStart,
  onClose,
  onMinimize,
  onFullscreen,
  onToggleSidebar,
  sidebarCollapsed,
  sidebarWidth,
  detailOpen = false,
}: {
  onDragStart: (e: ReactPointerEvent) => void
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
  onToggleSidebar: () => void
  sidebarCollapsed: boolean
  sidebarWidth: number
  /** When the one-up detail view is open, drop the full-bleed window-drag
   *  overlay to pointer-events:none so the detail's command bar (Back button,
   *  zoom slider) — which renders one z-layer below this header — receives
   *  clicks. The traffic lights + toggle keep their own pointer-events:auto
   *  containers, so they stay live above the detail. */
  detailOpen?: boolean
}) {
  /**
   * When the sidebar is visible, anchor the toggle button to the inside-right of the
   * sidebar so traffic lights + toggle visibly sit *within* the sidebar glass.
   * When collapsed, the toggle simply floats after the traffic-lights cluster.
   */
  const toggleAnchoredLeft =
    SIDEBAR_LEFT_INSET + sidebarWidth - SIDEBAR_RIGHT_INSET - TOGGLE_CLUSTER_WIDTH
  const toggleGap = sidebarCollapsed
    ? COLLAPSED_TOGGLE_GAP
    : Math.max(COLLAPSED_TOGGLE_GAP, toggleAnchoredLeft - TRAFFIC_BLOCK_END)

  /**
   * The header zone covers the sidebar's horizontal extent so a click-drag anywhere
   * over the sidebar's top strip moves the window. When the sidebar is collapsed
   * we fall back to a tight zone that just wraps the traffic lights + toggle chip.
   */
  const zoneWidth = sidebarCollapsed
    ? COLLAPSED_HEADER_ZONE_WIDTH
    : SIDEBAR_LEFT_INSET + sidebarWidth

  return (
    // z-30 (above the PhotosToolbar's z-20 drag layer): when the sidebar is
    // collapsed, the toolbar's frosted drag overlay starts at left: 12, which
    // overlaps the traffic-light + toggle zone. Without lifting the header, the
    // toolbar's drag layer would win the overlap (later in the tree, equal z),
    // making close/min/fullscreen and the sidebar-toggle chip drag-the-window
    // instead of fire onClick. Sitting one z-layer above the toolbar gives the
    // header (its drag overlay AND its interactive chips) priority on clicks.
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
        style={{ zIndex: 0, pointerEvents: detailOpen ? 'none' : 'auto' }}
        onPointerDown={onDragStart}
      />

      <div
        className="pointer-events-none relative z-[1] flex h-full w-full min-w-0 items-center"
        style={{ paddingLeft: TRAFFIC_LEFT_INSET }}
      >
        <div
          className="pointer-events-auto flex items-center"
          style={{ gap: 0 }}
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
          className="pointer-events-auto flex shrink-0 items-center"
          style={{ marginLeft: toggleGap }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Sidebar toggle. Chip styling mirrors NotesToolbar's sidebar
           *  toggle pixel-for-pixel — 38 × 36 pill, `rgba(60,60,60,0.30)`
           *  fill at rest, `rgba(60,60,60,0.75)` on hover, and the same
           *  diagonal-bevel inner-shadow recipe (top-right + bottom-left
           *  white highlight) so the same control reads identically
           *  whether you're in Notes or Photos. The icon glyph is the
           *  SF Symbol `sidebar.left.medium` (per the
           *  use-sf-symbols-only project rule) sized to 20 × 20 — same
           *  proportion as Notes' raster sidebar icon (16 × 12 inside a
           *  38 × 36 frame), but a clean vector path instead of a baked
           *  PNG.
           *
           *  Replaces the previous `GlassCluster` + `GlassButton` Tahoe
           *  Liquid Glass treatment, which sized to 42 × 40 and used a
           *  blurred translucent capsule. That read as a different
           *  control family next to Notes' simpler chrome rim, so the
           *  two apps' toggles felt like they belonged to different
           *  apps. The `bare`/`sidebarCollapsed` distinction is
           *  intentionally gone — this chip looks the same on both the
           *  sidebar's own glass surface and on photo content, so we
           *  don't need to swap variants. */}
          <div
            onClick={onToggleSidebar}
            aria-label="Hide or show sidebar"
            className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)]"
            style={{
              cursor: 'default',
              width: 38,
              height: 36,
              background: 'rgba(60, 60, 60, 0.30)',
              boxShadow:
                'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.92)',
            }}
          >
            <span
              className="inline-flex shrink-0 [&>svg]:block"
              style={{ width: 20, height: 20 }}
              dangerouslySetInnerHTML={{ __html: sidebarLeftMediumSvg }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
