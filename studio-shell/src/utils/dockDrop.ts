import type { DockZone } from '../types'

/** Used by proximity detection — matches studio-ai DockablePanel / TabbedPanel. */
export const EDGE_SIZE = 48

/** Detect which dock zone the cursor is near, using viewport edges + elementFromPoint fallback.
 * Center of viewport maps to `right-top` (explorer column top / sticky-target semantics). */
export function detectEdgeZone(
  clientX: number,
  clientY: number,
  viewportBounds: { left: number; top: number; width: number; height: number } | null
): DockZone | null {
  if (viewportBounds) {
    const vx = clientX - viewportBounds.left
    const vy = clientY - viewportBounds.top
    const inViewport =
      vx >= 0 && vx <= viewportBounds.width && vy >= 0 && vy <= viewportBounds.height
    if (inViewport && vy > viewportBounds.height - EDGE_SIZE) return 'center-bottom'
    if (inViewport && vx > viewportBounds.width - EDGE_SIZE) return 'right-bottom'
    if (inViewport && vx < EDGE_SIZE) return 'left'
    if (inViewport && vy < EDGE_SIZE) return 'center-top'
    if (inViewport) return 'right-top'
  }
  const element = document.elementFromPoint(clientX, clientY)
  if (element) {
    const zoneElement = element.closest('[data-zone]')
    if (zoneElement) return zoneElement.getAttribute('data-zone') as DockZone
  }
  return null
}
