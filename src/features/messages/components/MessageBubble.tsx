import { GLASS_PILL_BG } from '../../../components/liquid-glass/GlassControls'
import { DISPLAY_FONT_STACK } from '../../../styles/typography'
import tailSentSvg from '../../../../assets/figma/messages/bubble-tail-sent.svg?raw'
import tailReceivedSvg from '../../../../assets/figma/messages/bubble-tail-received.svg?raw'

/**
 * Message bubble transcribed from Figma.
 *
 * Source: figma.com/design/SRL00FMzps0OS5hlu5k62p — node 3:2075, component
 * `Message` (variants `orientation=Right, color=iMessage` for sent and
 * `orientation=Left, color=Light` for received).
 *
 * Every value below is verbatim from that node. The layer hierarchy is
 * mirrored: an outer column holding the bubble row, then the tail vector,
 * then the status line. The bubble row carries a -9px bottom margin so the
 * 14px tail overlaps the bubble by 9px and hangs 5px past its bottom edge.
 * That is how Figma composes it — the tail is a sibling vector, not a
 * pseudo-element or a thread-colored cutout.
 */

/** max-w-[263px] on both the bubble and its column. */
const BUBBLE_MAX_W = 263
/** rounded-[20px] — uniform, including on the tailed corner. */
const BUBBLE_RADIUS = 20
/** py-[9px] px-[13px] */
const BUBBLE_PAD = '9px 13px'
/** bg-[#269dfd] */
const SENT_FILL = '#269DFD'
const SENT_TEXT = '#FFFFFF'

/**
 * The received bubble departs from the Figma's `#E2E2E3` light-mode fill and
 * uses the app's Liquid Glass material instead. Text flips to white because
 * the surface is now dark and translucent.
 *
 * Deliberately no `backdrop-filter` here. The window is already the glass
 * surface — it blurs and saturates the wallpaper — and a second
 * backdrop-filter nested inside it re-roots the backdrop, which measured
 * *darker* than the thread (52 vs 62) instead of lifting off it. The bubble
 * is a translucent layer on that glass, not its own pane of it. This also
 * keeps one blur per window rather than one per bubble, which matters on a
 * long thread: Apple's guidance is to limit concurrent Liquid Glass effects.
 */
const RECEIVED_TEXT = '#FFFFFF'
const GLASS_RIM =
  'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10)'

/**
 * `GLASS_PILL_BG`'s 100% stop — the gradient value at the bubble's bottom
 * edge, which is exactly where the tail meets it. Flat rather than a repeat
 * of the gradient, so the two agree at the join.
 */
const RECEIVED_TAIL_FILL = 'rgba(255,255,255,0.07)'

/**
 * The tail overlaps the bubble by 9px, which is fine for the opaque blue
 * sent bubble but not for translucent glass: two glass layers stacked in
 * that band composite twice and leave a bright crescent along the bubble's
 * bottom corner.
 *
 * Apple's own answer to overlapping glass is `GlassEffectContainer` /
 * `glassEffectUnion`, which merge the shapes so the material is applied once
 * over the union. The CSS equivalent is to make the two shapes disjoint:
 * mask the tail with itself minus the bubble's rounded corner, so each pixel
 * is painted by exactly one glass surface.
 *
 * The corner is a plain rounded rect overshooting the tail box on three
 * sides, positioned so its bottom edge lands on the bubble's bottom edge.
 */
const CORNER_OVERSHOOT = 200

function cornerMaskSvg(fromMe: boolean) {
  const x = fromMe ? TAIL_W - CORNER_OVERSHOOT : 0
  const y = TAIL_OVERLAP - CORNER_OVERSHOOT
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${TAIL_W} ${TAIL_H}'><rect x='${x}' y='${y}' width='${CORNER_OVERSHOOT}' height='${CORNER_OVERSHOOT}' rx='${BUBBLE_RADIUS}'/></svg>`
}

const dataUri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

/** Tail shape minus the bubble's corner. Alpha masks, so fill colour is moot. */
function tailMaskStyle(fromMe: boolean) {
  const layers = `${dataUri(fromMe ? tailSentSvg : tailReceivedSvg)}, ${dataUri(cornerMaskSvg(fromMe))}`
  const size = `${TAIL_W}px ${TAIL_H}px`
  return {
    maskImage: layers,
    maskSize: size,
    maskRepeat: 'no-repeat',
    maskComposite: 'subtract',
    WebkitMaskImage: layers,
    WebkitMaskSize: size,
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskComposite: 'source-out',
  } as const
}
/** SF Pro Display Regular, text-[15px], leading-[1.2], tracking-[0.6px] */
const TEXT_SIZE = 15
const TEXT_LINE_HEIGHT = 1.2
const TEXT_TRACKING = '0.6px'
/** Frame 2234 / Frame 2235 — h-[14px] w-[24px] */
const TAIL_W = 24
const TAIL_H = 14
/** mb-[-9px] on the bubble row. */
const TAIL_OVERLAP = 9
/** Status line: text-[#89898d] text-[10px] tracking-[0.4px] px-[22px] gap-[3px] */
const STATUS_COLOR = '#89898D'
const STATUS_SIZE = 10
const STATUS_TRACKING = '0.4px'
const STATUS_PAD_X = 22
const STATUS_GAP = 3

export function MessageBubble({
  text,
  fromMe,
  hasTail,
  status,
}: {
  text: string
  fromMe: boolean
  /** Last bubble of a consecutive same-sender run gets the tail vector. */
  hasTail: boolean
  /** Figma's `statusMessage` slot ("Read" in the file, "Delivered" here). */
  status?: string
}) {
  return (
    <div
      className="flex flex-col"
      style={{
        alignItems: fromMe ? 'flex-end' : 'flex-start',
        maxWidth: BUBBLE_MAX_W,
      }}
    >
      <div
        className="flex"
        style={{ marginBottom: hasTail ? -TAIL_OVERLAP : 0, maxWidth: '100%' }}
      >
        <div
          className="flex items-start"
          style={{
            background: fromMe ? SENT_FILL : GLASS_PILL_BG,
            boxShadow: fromMe ? undefined : GLASS_RIM,
            borderRadius: BUBBLE_RADIUS,
            padding: BUBBLE_PAD,
            maxWidth: BUBBLE_MAX_W,
            overflow: 'clip',
          }}
        >
          <p
            style={{
              margin: 0,
              flex: '1 0 0',
              minWidth: 1,
              fontFamily: DISPLAY_FONT_STACK,
              fontSize: TEXT_SIZE,
              fontWeight: 400,
              lineHeight: TEXT_LINE_HEIGHT,
              letterSpacing: TEXT_TRACKING,
              color: fromMe ? SENT_TEXT : RECEIVED_TEXT,
              wordBreak: 'break-word',
            }}
          >
            {text}
          </p>
        </div>
      </div>

      {hasTail && (
        <div
          aria-hidden
          className="shrink-0"
          style={{
            width: TAIL_W,
            height: TAIL_H,
            background: fromMe ? SENT_FILL : RECEIVED_TAIL_FILL,
            ...tailMaskStyle(fromMe),
          }}
        />
      )}

      {status && (
        <div
          className="flex items-center"
          style={{
            gap: STATUS_GAP,
            paddingLeft: STATUS_PAD_X,
            paddingRight: STATUS_PAD_X,
            fontFamily: DISPLAY_FONT_STACK,
            fontSize: STATUS_SIZE,
            fontWeight: 600,
            lineHeight: TEXT_LINE_HEIGHT,
            letterSpacing: STATUS_TRACKING,
            color: STATUS_COLOR,
            whiteSpace: 'nowrap',
          }}
        >
          {status}
        </div>
      )}
    </div>
  )
}
