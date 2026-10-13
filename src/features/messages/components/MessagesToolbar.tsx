import { useMessagesStore } from '../../../stores/messages-store'
import { WINDOW_TITLE_STYLE, FONT_STACK } from '../../../styles/typography'
import {
  GlassCluster,
  GlassButton,
  GLASS_PILL_BG,
  GLASS_PILL_SHADOW,
  GLASS_PILL_BACKDROP,
} from '../../../components/liquid-glass/GlassControls'
import pencilSvg from '../../../../assets/sf-symbols/pencil.and.scribble--monochrome--medium.svg?raw'

const AVATAR_SIZE = 28

function Glyph({ svg, size = 16 }: { svg: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 [&>svg]:block"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

/**
 * Content-side Messages toolbar (macOS Tahoe 26 / WWDC25-356):
 * - Compose on the far left (leading functional control)
 * - Center: avatar circle stacked above contact name (name only in Liquid Glass)
 */
export function MessagesToolbar({
  height,
  onDragStart,
  contentLeftPx,
}: {
  height: number
  onDragStart: (e: React.PointerEvent) => void
  contentLeftPx: number
}) {
  const conversations = useMessagesStore((s) => s.conversations)
  const selectedId = useMessagesStore((s) => s.selectedId)
  const selected = conversations.find((c) => c.id === selectedId)

  return (
    <div
      className="pointer-events-none absolute right-0 top-0 z-20 flex items-center"
      style={{
        left: contentLeftPx,
        height,
        paddingLeft: 12,
        paddingRight: 16,
      }}
    >
      <div
        className="pointer-events-auto absolute inset-0"
        style={{ zIndex: 0 }}
        onPointerDown={onDragStart}
      />

      <div className="pointer-events-none relative z-[1] flex h-full w-full min-w-0 items-center">
        {/* Leading — compose */}
        <div
          className="pointer-events-auto flex shrink-0 items-center"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GlassCluster edge="soft">
            <GlassButton aria-label="Compose message">
              <Glyph svg={pencilSvg} />
            </GlassButton>
          </GlassCluster>
        </div>

        {/* Center — avatar above name; glass wraps name only */}
        {selected && (
          <div
            className="pointer-events-auto absolute left-1/2 top-1/2 flex flex-col items-center"
            style={{ transform: 'translate(-50%, -50%)', gap: 4 }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div
              aria-hidden
              className="flex shrink-0 items-center justify-center"
              style={{
                width: AVATAR_SIZE,
                height: AVATAR_SIZE,
                borderRadius: '50%',
                background: selected.avatarColor,
                color: '#fff',
                fontFamily: FONT_STACK,
                fontSize: selected.initials.length > 1 ? 9 : 11,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                boxShadow:
                  'inset 0 0 0 0.5px rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.22)',
              }}
            >
              {selected.initials}
            </div>
            <div
              role="button"
              aria-label={`${selected.name} — conversation details`}
              tabIndex={0}
              className="flex max-w-[min(280px,46vw)] items-center justify-center"
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: GLASS_PILL_BG,
                backdropFilter: GLASS_PILL_BACKDROP,
                WebkitBackdropFilter: GLASS_PILL_BACKDROP,
                boxShadow: GLASS_PILL_SHADOW,
                filter: 'url(#photos-lg-edge)',
                isolation: 'isolate',
                cursor: 'default',
              }}
            >
              <span
                className="truncate"
                style={{
                  ...WINDOW_TITLE_STYLE,
                  fontSize: 12,
                  lineHeight: 1.2,
                }}
              >
                {selected.name}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

