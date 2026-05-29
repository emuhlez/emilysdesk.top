import { TrafficLights } from '../../../components/TrafficLights'
import { useNotesStore } from '../../../stores/notes-store'
import sidebarLeftSvg from '../../../../notes/sidebar left.svg?raw'
import moreSvg from '../../../../notes/more.svg?raw'
import writingSvg from '../../../../notes/writing.svg?raw'
import tasksSvg from '../../../../notes/tasks.svg?raw'
import sharingSvg from '../../../../notes/sharing.svg?raw'
import searchSvg from '../../../../notes/search.svg?raw'
import searchExpandedSvg from '../../../../notes/search expanded.svg?raw'
import chevronRightSvg from '../../../../notes/chevron-right.svg?raw'

const SEARCH_EXPANDED_THRESHOLD = 900

// Left-side always-visible items total width:
// padding-left(16) + traffic lights(54) + sidebar(12+38) + notes title(18+~50)
// + spacer(80) + more(12+36) + divider(12+1)
const LEFT_BASE = 329
const MIN_GAP = 12
const WRITING_W = 48      // 12 margin + 36 width
const TASKS_MARGIN = 18

// Container widths for N visible task icons
const TASK_CONTAINER_WIDTHS = [0, 40, 80, 120, 158]
// Center x positions of each task icon in the SVG
const TASK_ICON_CENTERS = [20, 60, 100, 139]

// Strip SVG background rect so we can use HTML background instead
const tasksSvgIcons = tasksSvg.replace(/<rect width="158" height="36" rx="18"[^/]*\/>/, '')

function tasksWidthForCount(n: number): number {
  if (n <= 0) return 0
  return TASKS_MARGIN + TASK_CONTAINER_WIDTHS[n]
}

export function NotesToolbar({
  onToggleSidebar,
  onDragStart,
  onClose,
  onMinimize,
  onFullscreen,
  windowWidth,
}: {
  onToggleSidebar: () => void
  onDragStart: (e: React.PointerEvent) => void
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
  windowWidth: number
}) {
  const noteCount = useNotesStore((s) => s.notes.length)

  // Calculate available space
  // When expanded, search is flexible (min ~36, max 325) so use min for available calc
  const searchMin = windowWidth >= SEARCH_EXPANDED_THRESHOLD ? 36 : 36
  const rightWithSharing = 16 + searchMin + 18 + 80
  const rightWithoutSharing = 16 + searchMin + 18 + 36
  const availWithSharing = windowWidth - LEFT_BASE - MIN_GAP - rightWithSharing
  const availWithoutSharing = windowWidth - LEFT_BASE - MIN_GAP - rightWithoutSharing

  // Collapse order: sharing first, then task icons one by one, then writing
  let showWriting = false
  let taskCount = 0
  let showSharing = false
  let showChevron = false
  let resolved = false

  // Phase 1: Try with sharing visible (no chevron needed if everything fits)
  {
    const need = WRITING_W + tasksWidthForCount(4)
    if (availWithSharing >= need) {
      showWriting = true; taskCount = 4; showSharing = true
      resolved = true
    }
  }

  // Phase 2: Sharing collapses first, then task icons one by one, then writing
  // Chevron is on the right side (accounted for in rightWithoutSharing)
  for (let t = 4; t >= 0 && !resolved; t--) {
    const need = WRITING_W + tasksWidthForCount(t)
    if (availWithoutSharing >= need) {
      showWriting = true; taskCount = t; showChevron = true
      resolved = true
    }
  }
  for (let t = 4; t >= 0 && !resolved; t--) {
    const need = tasksWidthForCount(t)
    if (availWithoutSharing >= need) {
      taskCount = t; showChevron = true
      resolved = true
    }
  }
  if (!resolved) {
    showChevron = true
  }

  const taskContainerWidth = TASK_CONTAINER_WIDTHS[taskCount]

  // Calculate actual width search would get if expanded
  const leftUsed = LEFT_BASE
    + (showWriting ? WRITING_W : 0)
    + tasksWidthForCount(taskCount)
    + MIN_GAP
  const rightUsed = 16 + (showSharing ? 80 + 18 : 0) + (showChevron ? 36 + 18 : 0)
  const expandedSearchWidth = windowWidth - leftUsed - rightUsed
  const showExpandedSearch = windowWidth >= SEARCH_EXPANDED_THRESHOLD && expandedSearchWidth >= 155

  return (
    <div
      className="flex shrink-0 items-center pl-5 pr-4"
      style={{
        height: 50,
        cursor: 'default',
        touchAction: 'none',
        background: '#222222',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
      onPointerDown={onDragStart}
    >
      {/* 20px traffic-light left inset matches the macOS canonical position
       *  used by `PhotosSidebarHeader.tsx:21` (TRAFFIC_LEFT_INSET). Right
       *  side stays at 16px because no chrome element pins to it. */}
      <TrafficLights onClose={onClose} onMinimize={onMinimize} onFullscreen={onFullscreen} />
      {/* Sidebar toggle */}
      <div
        onClick={(e) => { e.stopPropagation(); onToggleSidebar() }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)] [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[38px]"
        style={{
          cursor: 'default',
          width: 38,
          height: 36,
          marginLeft: 12,
          boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
        }}
        dangerouslySetInnerHTML={{ __html: sidebarLeftSvg }}
      />
      {/* Title + note count */}
      <div className="flex shrink-0 flex-col whitespace-nowrap leading-tight" style={{ marginLeft: 18 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>Notes</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)' }}>{noteCount} {noteCount === 1 ? 'note' : 'notes'}</span>
      </div>
      {/* Spacer */}
      <div style={{ width: 80 }} />
      {/* More button */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)] [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[36px]"
        style={{
          cursor: 'default',
          width: 36,
          height: 36,
          marginLeft: 12,
          boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
        }}
        dangerouslySetInnerHTML={{ __html: moreSvg }}
      />
      {/* Divider */}
      <div style={{ width: 1, height: 30, marginLeft: 12, background: 'rgba(255,255,255,0.15)' }} />
      {showWriting && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)] [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[36px]"
          style={{
            cursor: 'default',
            width: 36,
            height: 36,
            marginLeft: 12,
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
          dangerouslySetInnerHTML={{ __html: writingSvg }}
        />
      )}
      {/* Tasks — variable number of icons */}
      {taskCount > 0 && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative shrink-0 overflow-hidden"
          style={{
            width: taskContainerWidth,
            height: 36,
            cursor: 'default',
            marginLeft: TASKS_MARGIN,
            borderRadius: 18,
            background: 'rgba(60,60,60,0.3)',
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
        >
          {/* SVG icons (no background — container provides it) */}
          <div
            className="pointer-events-none absolute inset-0 [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[158px]"
            dangerouslySetInnerHTML={{ __html: tasksSvgIcons }}
          />
          {/* Individual hover zones at fixed positions */}
          {Array.from({ length: taskCount }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              style={{
                width: 30,
                height: 30,
                left: TASK_ICON_CENTERS[i] - 15,
                top: 3,
              }}
            />
          ))}
        </div>
      )}
      {/* Flexible spacer pushes right group to the right */}
      <div className="flex-1" style={{ minWidth: MIN_GAP }} />
      {/* Chevron — anchored on right side */}
      {showChevron && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)] [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[36px]"
          style={{
            cursor: 'default',
            width: 36,
            height: 36,
            marginRight: 18,
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
          dangerouslySetInnerHTML={{ __html: chevronRightSvg }}
        />
      )}
      {/* Sharing — grouped with search on the right */}
      {showSharing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative shrink-0 rounded-full"
          style={{
            width: 80,
            height: 36,
            cursor: 'default',
            marginRight: 18,
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[80px]"
            dangerouslySetInnerHTML={{ __html: sharingSvg }}
          />
          <div className="relative flex h-full items-center justify-around">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-full transition-colors hover:bg-[rgba(255,255,255,0.08)]"
                style={{ width: 30, height: 30 }}
              />
            ))}
          </div>
        </div>
      )}
      {/* Search — always anchored right, flexible width when expanded */}
      {showExpandedSearch ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex min-w-0 flex-1 items-center rounded-full"
          style={{
            cursor: 'default',
            maxWidth: 325,
            height: 36,
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-full [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[325px]"
            dangerouslySetInnerHTML={{ __html: searchExpandedSvg }}
          />
          <span className="relative" style={{ fontSize: 12, fontWeight: 600, color: '#949393', marginLeft: 38 }}>Search</span>
        </div>
      ) : (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="shrink-0 flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)] [&_svg]:block [&_svg]:h-[36px] [&_svg]:w-[36px]"
          style={{
            cursor: 'default',
            width: 36,
            height: 36,
            boxShadow: 'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)',
          }}
          dangerouslySetInnerHTML={{ __html: searchSvg }}
        />
      )}
    </div>
  )
}
