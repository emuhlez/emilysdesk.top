import { TrafficLights } from '../../../components/TrafficLights'
import { useNotesStore } from '../../../stores/notes-store'
import { WINDOW_TITLE_STYLE, WINDOW_SUBTITLE_STYLE } from '../../../styles/typography'
import { TITLE_BAR_BG } from '../../../constants/window-chrome'
import sidebarLeftSvg from '../../../../assets/sf-symbols/sidebar.left--monochrome--medium.svg?raw'
import ellipsisCircleSvg from '../../../../assets/sf-symbols/ellipsis.circle--monochrome--medium.svg?raw'
import pencilSvg from '../../../../assets/sf-symbols/pencil.and.scribble--monochrome--medium.svg?raw'
import magnifyingglassSvg from '../../../../assets/sf-symbols/magnifyingglass--monochrome--medium.svg?raw'
import chevronRightSvg from '../../../../assets/sf-symbols/chevron.right--monochrome--medium.svg?raw'
import person2Svg from '../../../../assets/sf-symbols/person.2--monochrome--medium.svg?raw'
import shareSvg from '../../../../assets/sf-symbols/square.and.arrow.up--monochrome--medium.svg?raw'
import squareStackSvg from '../../../../assets/sf-symbols/square.stack--monochrome--medium.svg?raw'
import rectangleStackSvg from '../../../../assets/sf-symbols/rectangle.stack--monochrome--medium.svg?raw'
import photoSvg from '../../../../assets/sf-symbols/photo--monochrome--medium.svg?raw'
import tableLikeSvg from '../../../../assets/sf-symbols/square.grid.2x2--monochrome--medium.svg?raw'

const SEARCH_EXPANDED_THRESHOLD = 900

// Left-side always-visible items total width:
// padding-left(16) + traffic lights(54) + sidebar(12+38) + notes title(18+~50)
// + spacer(80) + more(12+36) + divider(12+1)
const LEFT_BASE = 329
const MIN_GAP = 12
const WRITING_W = 48 // 12 margin + 36 width
const TASKS_MARGIN = 18

const TASK_CONTAINER_WIDTHS = [0, 40, 80, 120, 158]
const TASK_ICON_CENTERS = [20, 60, 100, 139]
const TASK_GLYPHS = [squareStackSvg, tableLikeSvg, photoSvg, rectangleStackSvg]

const CHIP_BEVEL =
  'inset 1px -1px 0 0 rgba(255,255,255,0.12), inset -1px 1px 0 0 rgba(255,255,255,0.12)'
const CHIP_REST = 'rgba(60,60,60,0.30)'

function tasksWidthForCount(n: number): number {
  if (n <= 0) return 0
  return TASKS_MARGIN + TASK_CONTAINER_WIDTHS[n]
}

/** Notes chrome chip — matches PhotosSidebarHeader toggle recipe. */
function ChromeChip({
  svg,
  width = 36,
  height = 36,
  iconSize = 18,
  marginLeft,
  marginRight,
  onClick,
  'aria-label': ariaLabel,
}: {
  svg: string
  width?: number
  height?: number
  iconSize?: number
  marginLeft?: number
  marginRight?: number
  onClick?: (e: React.MouseEvent) => void
  'aria-label'?: string
}) {
  return (
    <div
      role={ariaLabel ? 'button' : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className="flex shrink-0 items-center justify-center rounded-full transition-colors hover:bg-[rgba(60,60,60,0.75)]"
      style={{
        cursor: 'default',
        width,
        height,
        marginLeft,
        marginRight,
        background: CHIP_REST,
        boxShadow: CHIP_BEVEL,
        color: 'rgba(255,255,255,0.92)',
      }}
    >
      <span
        className="inline-flex shrink-0 [&>svg]:block"
        style={{ width: iconSize, height: iconSize }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  )
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

  const searchMin = windowWidth >= SEARCH_EXPANDED_THRESHOLD ? 36 : 36
  const rightWithSharing = 16 + searchMin + 18 + 80
  const rightWithoutSharing = 16 + searchMin + 18 + 36
  const availWithSharing = windowWidth - LEFT_BASE - MIN_GAP - rightWithSharing
  const availWithoutSharing = windowWidth - LEFT_BASE - MIN_GAP - rightWithoutSharing

  let showWriting = false
  let taskCount = 0
  let showSharing = false
  let showChevron = false
  let resolved = false

  {
    const need = WRITING_W + tasksWidthForCount(4)
    if (availWithSharing >= need) {
      showWriting = true
      taskCount = 4
      showSharing = true
      resolved = true
    }
  }

  for (let t = 4; t >= 0 && !resolved; t--) {
    const need = WRITING_W + tasksWidthForCount(t)
    if (availWithoutSharing >= need) {
      showWriting = true
      taskCount = t
      showChevron = true
      resolved = true
    }
  }
  for (let t = 4; t >= 0 && !resolved; t--) {
    const need = tasksWidthForCount(t)
    if (availWithoutSharing >= need) {
      taskCount = t
      showChevron = true
      resolved = true
    }
  }
  if (!resolved) {
    showChevron = true
  }

  const taskContainerWidth = TASK_CONTAINER_WIDTHS[taskCount]

  const leftUsed =
    LEFT_BASE + (showWriting ? WRITING_W : 0) + tasksWidthForCount(taskCount) + MIN_GAP
  const rightUsed = 16 + (showSharing ? 80 + 18 : 0) + (showChevron ? 36 + 18 : 0)
  const expandedSearchWidth = windowWidth - leftUsed - rightUsed
  const showExpandedSearch =
    windowWidth >= SEARCH_EXPANDED_THRESHOLD && expandedSearchWidth >= 155

  return (
    <div
      className="flex shrink-0 items-center pl-5 pr-4"
      style={{
        height: 50,
        cursor: 'default',
        touchAction: 'none',
        background: TITLE_BAR_BG,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}
      onPointerDown={onDragStart}
    >
      <TrafficLights onClose={onClose} onMinimize={onMinimize} onFullscreen={onFullscreen} />
      <ChromeChip
        svg={sidebarLeftSvg}
        width={38}
        height={36}
        iconSize={20}
        marginLeft={12}
        aria-label="Hide or show sidebar"
        onClick={(e) => {
          e.stopPropagation()
          onToggleSidebar()
        }}
      />
      <div className="flex shrink-0 flex-col whitespace-nowrap leading-tight" style={{ marginLeft: 18 }}>
        <span style={WINDOW_TITLE_STYLE}>Notes</span>
        <span style={WINDOW_SUBTITLE_STYLE}>
          {noteCount} {noteCount === 1 ? 'note' : 'notes'}
        </span>
      </div>
      <div style={{ width: 80 }} />
      <ChromeChip svg={ellipsisCircleSvg} marginLeft={12} aria-label="More" />
      <div style={{ width: 1, height: 30, marginLeft: 12, background: 'rgba(255,255,255,0.15)' }} />
      {showWriting && (
        <ChromeChip svg={pencilSvg} marginLeft={12} aria-label="New note" />
      )}
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
            background: CHIP_REST,
            boxShadow: CHIP_BEVEL,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {Array.from({ length: taskCount }).map((_, i) => (
            <div
              key={i}
              className="absolute flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              style={{
                width: 30,
                height: 30,
                left: TASK_ICON_CENTERS[i] - 15,
                top: 3,
              }}
            >
              <span
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 16, height: 16 }}
                dangerouslySetInnerHTML={{ __html: TASK_GLYPHS[i] }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex-1" style={{ minWidth: MIN_GAP }} />
      {showChevron && (
        <ChromeChip svg={chevronRightSvg} marginRight={18} aria-label="More tools" />
      )}
      {showSharing && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex shrink-0 items-center justify-around rounded-full"
          style={{
            width: 80,
            height: 36,
            cursor: 'default',
            marginRight: 18,
            background: CHIP_REST,
            boxShadow: CHIP_BEVEL,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          {[person2Svg, shareSvg].map((svg, i) => (
            <div
              key={i}
              className="flex items-center justify-center rounded-full transition-colors hover:bg-[rgba(255,255,255,0.08)]"
              style={{ width: 30, height: 30 }}
            >
              <span
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 16, height: 16 }}
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          ))}
        </div>
      )}
      {showExpandedSearch ? (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="relative flex min-w-0 flex-1 items-center rounded-full"
          style={{
            cursor: 'default',
            maxWidth: 325,
            height: 36,
            background: CHIP_REST,
            boxShadow: CHIP_BEVEL,
            color: 'rgba(255,255,255,0.92)',
          }}
        >
          <span
            className="inline-flex shrink-0 [&>svg]:block"
            style={{ width: 16, height: 16, marginLeft: 12 }}
            dangerouslySetInnerHTML={{ __html: magnifyingglassSvg }}
          />
          <span
            className="relative"
            style={{ fontSize: 12, fontWeight: 600, color: '#949393', marginLeft: 10 }}
          >
            Search
          </span>
        </div>
      ) : (
        <ChromeChip svg={magnifyingglassSvg} aria-label="Search" />
      )}
    </div>
  )
}
