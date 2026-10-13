import { useState } from 'react'
import {
  conversationPreview,
  conversationUpdatedAt,
  useMessagesStore,
} from '../../../stores/messages-store'
import magnifyingglassSvg from '../../../../assets/sf-symbols/magnifyingglass--monochrome--medium.svg?raw'
import { FONT_STACK } from '../../../styles/typography'
const SEARCH_H = 36
/** Pull search up under the 64px chrome (traffic lights / filter). */
const SEARCH_TOP_GAP = -20
const SEARCH_BOTTOM_GAP = 10
/** Soft dissolve under the hard scroll-edge (WWDC25-356). */
const EDGE_FADE_H = 24

/**
 * WWDC25-356 concentricity: window radius 24, sidebar float inset 10 →
 * sidebar radius = 24 − 10 = 14. Nested row pad ≈ 8 → row radius 6.
 * Search uses capsule (radius = half height) — system shape for fields.
 */
export const SIDEBAR_RADIUS = 14
const ROW_RADIUS = 6

function formatListTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Floating Liquid Glass conversation list — WWDC25-356 structure:
 * inset sidebar, material on the control surface, content extends behind,
 * one hard macOS scroll-edge over the pinned search (not a darkening overlay).
 */
export function MessagesSidebar({
  width,
  onResizeStart,
  topContentInset = 0,
}: {
  width: number
  onResizeStart: (e: React.PointerEvent) => void
  topContentInset?: number
}) {
  const conversations = useMessagesStore((s) => s.conversations)
  const selectedId = useMessagesStore((s) => s.selectedId)
  const selectConversation = useMessagesStore((s) => s.selectConversation)
  const searchQuery = useMessagesStore((s) => s.searchQuery)
  const setSearchQuery = useMessagesStore((s) => s.setSearchQuery)

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const q = searchQuery.trim().toLowerCase()
  const filtered = conversations
    .filter((c) => {
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        conversationPreview(c).toLowerCase().includes(q)
      )
    })
    .sort((a, b) => conversationUpdatedAt(b) - conversationUpdatedAt(a))

  const edgeSolidH = topContentInset + SEARCH_TOP_GAP + SEARCH_H + SEARCH_BOTTOM_GAP
  const edgeBandH = edgeSolidH + EDGE_FADE_H

  return (
    <div
      className="relative flex h-full min-h-0 w-full shrink-0 flex-col"
      style={{
        width,
        borderRadius: SIDEBAR_RADIUS,
        boxShadow: '0 6px 18px -10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      {/* Liquid Glass functional layer — material on the surface, not children. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          /* The window is the glass pane; this is a panel lifted off it. A
             nested backdrop-filter re-roots the backdrop and renders the
             sidebar darker than the thread (measured 30 vs 44) instead of
             floating above it, so lift with a translucent wash instead. */
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.05) 100%)',
          borderRadius: SIDEBAR_RADIUS,
          boxShadow:
            '0 0 0 0.5px rgba(255,255,255,0.08), inset 0 0.5px 0 rgba(255,255,255,0.22), inset 0 -0.5px 0 rgba(255,255,255,0.05), inset 0 0 0 0.5px rgba(255,255,255,0.10)',
          filter: 'url(#photos-lg-sidebar)',
        }}
      />

      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        style={{
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: edgeSolidH,
          paddingBottom: 14,
          borderRadius: SIDEBAR_RADIUS,
        }}
      >
        <div className="flex w-full flex-col" style={{ width: '100%' }}>
          {filtered.map((c) => {
            const isActive = c.id === selectedId
            const isHovered = c.id === hoveredId
            const preview = conversationPreview(c)
            const updatedAt = conversationUpdatedAt(c)

            return (
              <div
                key={c.id}
                className="relative flex w-full shrink-0 cursor-default items-center"
                style={{
                  padding: '6px 8px',
                  gap: 8,
                  borderRadius: ROW_RADIUS,
                  color: '#ffffff',
                  background: isActive
                    ? 'linear-gradient(180deg, rgba(10,132,255,0.95) 0%, rgba(10,132,255,0.82) 100%)'
                    : isHovered
                      ? 'rgba(255,255,255,0.08)'
                      : undefined,
                  boxShadow: isActive
                    ? 'inset 0 0.5px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(10,132,255,0.28)'
                    : undefined,
                  transition:
                    'background 140ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 140ms cubic-bezier(0.32, 0.72, 0, 1)',
                }}
                onClick={() => selectConversation(c.id)}
                onMouseEnter={() => setHoveredId(c.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  className="flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: 32,
                    height: 32,
                    background: isActive ? 'rgba(255,255,255,0.22)' : c.avatarColor,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {c.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className="min-w-0 truncate"
                      style={{
                        fontFamily: FONT_STACK,
                        fontSize: 12,
                        fontWeight: 600,
                        letterSpacing: '-0.08px',
                        color: '#ffffff',
                      }}
                    >
                      {c.name}
                    </span>
                    <span
                      className="ml-auto shrink-0"
                      style={{
                        fontFamily: FONT_STACK,
                        fontSize: 11,
                        fontWeight: 400,
                        color: isActive ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                      }}
                    >
                      {formatListTime(updatedAt)}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 truncate"
                    style={{
                      fontFamily: FONT_STACK,
                      fontSize: 11,
                      fontWeight: 400,
                      color: isActive ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.50)',
                    }}
                  >
                    {preview}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Hard macOS scroll-edge (WWDC25-356): clarifies UI↔content meeting.
          Not a darkening overlay — blur + soft fade only. One edge per pane. */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-[3]"
        style={{
          height: edgeBandH,
          borderTopLeftRadius: SIDEBAR_RADIUS,
          borderTopRightRadius: SIDEBAR_RADIUS,
          background:
            'linear-gradient(to bottom, rgba(22,22,22,0.72) 0%, rgba(22,22,22,0.42) 55%, rgba(22,22,22,0) 100%)',
          backdropFilter: 'blur(40px) saturate(160%)',
          WebkitBackdropFilter: 'blur(40px) saturate(160%)',
          maskImage: `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${edgeSolidH}px, rgba(0,0,0,0) 100%)`,
          WebkitMaskImage: `linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) ${edgeSolidH}px, rgba(0,0,0,0) 100%)`,
        }}
      >
        <div
          className="pointer-events-auto"
          style={{
            paddingTop: topContentInset + SEARCH_TOP_GAP,
            paddingLeft: 12,
            paddingRight: 12,
          }}
        >
          {/* Capsule search — system shape for standout field controls. */}
          <div
            className="flex items-center"
            style={{
              height: SEARCH_H,
              borderRadius: SEARCH_H / 2,
              /* Flat, no shadow, darker than the sidebar. Now that the window
                 is translucent this has to be a darkening wash rather than a
                 solid tone, or it reads as an opaque patch on the glass. */
              background: 'rgba(0,0,0,0.24)',
              boxShadow: 'none',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <span
              className="inline-flex shrink-0 [&>svg]:block"
              style={{ width: 13, height: 13, marginLeft: 10 }}
              dangerouslySetInnerHTML={{ __html: magnifyingglassSvg }}
            />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="min-w-0 flex-1 bg-transparent outline-none"
              style={{
                fontFamily: FONT_STACK,
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.92)',
                marginLeft: 6,
                marginRight: 10,
              }}
            />
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 z-[2] h-full w-2 cursor-col-resize"
        style={{ right: -4, touchAction: 'none' }}
        onPointerDown={onResizeStart}
      />
    </div>
  )
}
