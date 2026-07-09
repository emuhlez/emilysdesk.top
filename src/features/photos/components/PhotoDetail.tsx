import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PropsWithChildren } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import chevronRightSvg from '../../../../assets/sf-symbols/chevron.right--monochrome--medium.svg?raw'
import minusSvg from '../../../../assets/sf-symbols/minus--monochrome--medium.svg?raw'
import plusSvg from '../../../../assets/sf-symbols/plus--monochrome--medium.svg?raw'
import infoCircleSvg from '../../../../assets/sf-symbols/info.circle--monochrome--medium.svg?raw'
import shareSvg from '../../../../assets/sf-symbols/square.and.arrow.up--monochrome--medium.svg?raw'
import heartSvg from '../../../../assets/sf-symbols/heart--monochrome--medium.svg?raw'
import heartFillSvg from '../../../../assets/sf-symbols/heart.fill--hierarchical--medium.svg?raw'
import {
  filterPhotosBySection,
  usePhotosStore,
} from '../../../stores/photos-store'
import { COLLAPSED_HEADER_ZONE_WIDTH } from './PhotosSidebarHeader'
import { VideoControls } from './VideoControls'

/* The detail layer sits ON the window's own surface with a *transparent*
 * background — so the focused view shows the exact same single translucent
 * window fill (rgba(30,30,30,0.92), which samples the wallpaper) as the grid's
 * empty areas, instead of a flatter opaque panel that read darker than the
 * grid. The grid behind is faded out while detail is open (see PhotosWindow)
 * so photos don't bleed through this transparent layer. zIndex 25 keeps it
 * above the toolbar (z-20) but BELOW the traffic-lights header (z-30), so
 * close/min/zoom stay live. The top command bar is left-padded by
 * COLLAPSED_HEADER_ZONE_WIDTH to clear the traffic-lights zone. */
const DETAIL_Z = 25
const BAR_H = 64
const ZOOM_MIN = 1
const ZOOM_MAX = 3
/* Per-property framer-motion transition for the detail view's left edge. It
 * tracks the sidebar slide, so it runs on PhotosWindow's shared sidebar curve
 * (0.38s, cubic-bezier(0.32,0.72,0,1)). Driving `left` through framer-motion —
 * rather than a CSS `transition` string in the style prop — is deliberate:
 * framer owns the element's inline style while animating opacity/scale and does
 * not honor CSS transitions, so a per-property transition is the only reliable
 * way to keep `left` on the 0.38s curve instead of inheriting the 0.26s default. */
const LEFT_TRANSITION = { duration: 0.38, ease: [0.32, 0.72, 0, 1] } as const

const FONT = '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif'

/* Liquid-Glass pill recipe lifted from PhotosToolbar's GlassCluster so the
 * detail bar reads as the same control family as the grid toolbar. */
const GLASS_BG =
  'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.07) 100%)'
const GLASS_SHADOW =
  'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 1px rgba(0,0,0,0.18), 0 6px 14px -8px rgba(0,0,0,0.30)'

function GlassCluster({
  children,
  style,
}: PropsWithChildren<{ style?: CSSProperties }>) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        gap: 1,
        padding: '5px 8px',
        borderRadius: 999,
        background: GLASS_BG,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: GLASS_SHADOW,
        isolation: 'isolate',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function GlassButton({
  svg,
  label,
  onClick,
  active = false,
}: {
  svg: string
  label: string
  onClick?: () => void
  active?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      role="button"
      aria-label={label}
      aria-pressed={active || undefined}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center focus:outline-none"
      style={{
        position: 'relative',
        flexShrink: 0,
        width: 30,
        height: 30,
        minWidth: 30,
        minHeight: 30,
        cursor: 'default',
        color: active ? '#ff5a55' : 'rgba(255,255,255,0.92)',
        zIndex: 2,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 30,
          height: 30,
          transform: 'translate(-50%, -50%)',
          borderRadius: 15,
          background: hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        className="relative inline-flex shrink-0 [&>svg]:block"
        style={{ width: 18, height: 18 }}
        dangerouslySetInnerHTML={{ __html: active ? heartFillSvg : svg }}
      />
    </div>
  )
}

/* Functional pill zoom slider — − thumb +. Maps the thumb track linearly onto
 * [ZOOM_MIN, ZOOM_MAX]; the parent applies the value as a CSS transform scale
 * on the media. The +/− buttons nudge by 1/8 of the range. */
function ZoomSlider({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const t = (value - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)
  const step = (ZOOM_MAX - ZOOM_MIN) / 8

  const setFromX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      onChange(ZOOM_MIN + ratio * (ZOOM_MAX - ZOOM_MIN))
    },
    [onChange],
  )

  return (
    <GlassCluster style={{ gap: 4, padding: '4px 8px' }}>
      <GlassButton
        svg={minusSvg}
        label="Zoom out"
        onClick={() => onChange(Math.max(ZOOM_MIN, value - step))}
      />
      <div
        ref={trackRef}
        onPointerDown={(e) => {
          e.stopPropagation()
          e.currentTarget.setPointerCapture(e.pointerId)
          setFromX(e.clientX)
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) setFromX(e.clientX)
        }}
        style={{
          position: 'relative',
          width: 88,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          cursor: 'default',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.22)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: `${t * 100}%`,
            height: 3,
            borderRadius: 2,
            background: 'rgba(255,255,255,0.55)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${t * 100}%`,
            transform: 'translateX(-50%)',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
          }}
        />
      </div>
      <GlassButton
        svg={plusSvg}
        label="Zoom in"
        onClick={() => onChange(Math.min(ZOOM_MAX, value + step))}
      />
    </GlassCluster>
  )
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})
const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

/**
 * One-up focused view, opened when a grid item is selected.
 *
 * Fills the window content area on the window's own dark surface (no black
 * lightbox), under the traffic-lights header. A top command bar mirrors
 * macOS Photos.app's one-up toolbar: back, functional zoom slider, centered
 * title + meta, and a glass action cluster (info / share / favorite) plus an
 * Edit button. Videos render a full <video> player; images render contained,
 * both scaled by the zoom slider. Selection is the single source of truth.
 */
export function PhotoDetail({
  leftInset = 0,
  barPadLeft = COLLAPSED_HEADER_ZONE_WIDTH,
}: {
  /** Left offset so the view clears the floating sidebar when it's open
   *  (animated on the shared sidebar curve). */
  leftInset?: number
  /** Inner left padding for the command bar (clears traffic lights/toggle when
   *  the sidebar is collapsed; small gutter when it's open). */
  barPadLeft?: number
} = {}) {
  const photos = usePhotosStore((s) => s.photos)
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectedPhotoId = usePhotosStore((s) => s.selectedPhotoId)
  const selectPhoto = usePhotosStore((s) => s.selectPhoto)
  const toggleFavorite = usePhotosStore((s) => s.toggleFavorite)

  const visible = useMemo(
    () => filterPhotosBySection(photos, selectedSection),
    [photos, selectedSection],
  )

  const index = visible.findIndex((p) => p.id === selectedPhotoId)
  const photo = index >= 0 ? visible[index] : null

  const [zoom, setZoom] = useState(ZOOM_MIN)
  /* The current focused <video> element, captured via callback ref so the
   * custom playback bar re-binds whenever navigation mounts a new clip. */
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)

  const close = useCallback(() => selectPhoto(null), [selectPhoto])

  const goTo = useCallback(
    (delta: number) => {
      if (index < 0) return
      const next = index + delta
      if (next < 0 || next >= visible.length) return
      selectPhoto(visible[next].id)
    },
    [index, visible, selectPhoto],
  )

  /* Reset zoom to fit whenever the focused item changes. Done during render via
   * the "adjust state when a value changes" pattern rather than in an effect, so
   * it doesn't schedule a second, cascading render after commit. */
  const [zoomedPhotoId, setZoomedPhotoId] = useState(photo?.id)
  if (photo?.id !== zoomedPhotoId) {
    setZoomedPhotoId(photo?.id)
    setZoom(ZOOM_MIN)
  }

  /* Keyboard: Escape closes, ←/→ step through neighbors. Bound only while the
   * detail view is open so it doesn't intercept keys for the grid underneath. */
  useEffect(() => {
    if (!photo) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        goTo(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        goTo(1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [photo, close, goTo])

  const hasPrev = index > 0
  const hasNext = index >= 0 && index < visible.length - 1

  const meta = photo
    ? `${DATE_FMT.format(new Date(photo.date))} at ${TIME_FMT.format(
        new Date(photo.date),
      )} · ${index + 1} of ${visible.length}`
    : ''

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          className="absolute"
          style={{
            top: 0,
            right: 0,
            bottom: 0,
            zIndex: DETAIL_Z,
            background: 'transparent',
            cursor: 'default',
          }}
          /* Open: settle in from a hair larger (feels like the photo coming
           * forward). Close: ease back out to the grid with a matching scale
           * so the dismissal reads as receding rather than a flat cut.
           *
           * `left` is animated by framer-motion (not via CSS in `style`) so it
           * stays in lockstep with the sidebar slide — initial === animate so it
           * never animates on mount, only when `leftInset` changes as the
           * sidebar opens/closes. It gets its own 0.38s curve via LEFT_TRANSITION
           * while opacity/scale keep the snappier 0.26s open/close timing. */
          initial={{ opacity: 0, scale: 1.012, left: leftInset }}
          animate={{ opacity: 1, scale: 1, left: leftInset }}
          exit={{ opacity: 0, scale: 1.012 }}
          transition={{
            duration: 0.26,
            ease: [0.32, 0.72, 0, 1],
            left: LEFT_TRANSITION,
          }}
        >
          {/* Media stage — fills everything below the command bar. */}
          <div
            className="absolute overflow-hidden"
            style={{ top: BAR_H, left: 0, right: 0, bottom: 0 }}
          >
            <motion.div
              key={photo.id}
              className="absolute inset-0 flex items-center justify-center"
              style={{ padding: '24px 56px' }}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              <div
                style={{
                  display: 'flex',
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transform: `scale(${zoom})`,
                  transformOrigin: 'center',
                  transition: 'transform 120ms ease',
                }}
              >
                {photo.isVideo && photo.videoSrc ? (
                  <video
                    key={photo.videoSrc}
                    ref={setVideoEl}
                    src={photo.videoSrc}
                    poster={photo.poster}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: 10,
                      outline: 'none',
                      /* <video> paints an opaque black box by default (both the
                       * letterbox margins and any unpainted area). Make it
                       * transparent so it falls through to the window surface,
                       * matching the sidebar / grid instead of reading as a
                       * black rectangle. */
                      background: 'transparent',
                    }}
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      borderRadius: 10,
                    }}
                    draggable={false}
                  />
                )}
              </div>
            </motion.div>

            {hasPrev && <NavButton side="left" onClick={() => goTo(-1)} />}
            {hasNext && <NavButton side="right" onClick={() => goTo(1)} />}

            {/* Custom playback bar, anchored to the stage bottom so it stays
                put regardless of the media zoom. */}
            {photo.isVideo && photo.videoSrc && (
              <div
                className="absolute flex justify-center"
                style={{ left: 0, right: 0, bottom: 20 }}
              >
                <VideoControls videoEl={videoEl} />
              </div>
            )}
          </div>

          {/* Top command bar — single row, BAR_H tall, left-padded to clear
              the traffic-lights zone. */}
          <div
            className="absolute left-0 right-0 top-0 flex items-center"
            style={{
              height: BAR_H,
              paddingLeft: barPadLeft,
              paddingRight: 16,
              zIndex: 2,
              transition: 'padding-left 380ms cubic-bezier(0.32, 0.72, 0, 1)',
            }}
          >
            {/* Left group: back + zoom. */}
            <div className="flex items-center" style={{ gap: 10 }}>
              <motion.button
                type="button"
                aria-label="Back"
                onClick={close}
                className="flex items-center justify-center focus:outline-none"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background: GLASS_BG,
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  boxShadow: GLASS_SHADOW,
                  color: 'rgba(255,255,255,0.92)',
                  cursor: 'default',
                }}
                /* Tactile, springy feedback so the press reads as a physical
                 * button rather than an instant state flip. */
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 600, damping: 28, mass: 0.5 }}
              >
                <span
                  aria-hidden
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{
                    width: 15,
                    height: 15,
                    /* chevron.right's path is symmetric about the viewBox
                     * centre (x: 3.9–12.1 in 0–16), so a plain horizontal
                     * flip yields a back chevron that's already centred — no
                     * optical nudge needed. */
                    transform: 'scaleX(-1)',
                  }}
                  dangerouslySetInnerHTML={{ __html: chevronRightSvg }}
                />
              </motion.button>

              <ZoomSlider value={zoom} onChange={setZoom} />
            </div>

            {/* Centered title + meta (centered to the window, mirrors
                TitlePlate typography). */}
            <div
              className="pointer-events-none absolute flex flex-col items-center leading-tight"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            >
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '-0.14px',
                  color: 'rgba(255,255,255,0.96)',
                  whiteSpace: 'nowrap',
                }}
              >
                {photo.alt}
              </span>
              <span
                style={{
                  fontFamily: FONT,
                  fontSize: 11,
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.52)',
                  whiteSpace: 'nowrap',
                  marginTop: 1,
                }}
              >
                {meta}
              </span>
            </div>

            {/* Right group: action cluster + Edit. */}
            <div
              className="ml-auto flex items-center"
              style={{ gap: 8 }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <GlassCluster style={{ gap: 1 }}>
                <GlassButton svg={infoCircleSvg} label="Info" />
                <GlassButton svg={shareSvg} label="Share" />
                <GlassButton
                  svg={heartSvg}
                  label={photo.favorite ? 'Remove favorite' : 'Favorite'}
                  active={photo.favorite}
                  onClick={() => toggleFavorite(photo.id)}
                />
              </GlassCluster>

              <EditButton />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function EditButton({ onClick }: { onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative focus:outline-none"
      style={{
        height: 30,
        padding: '0 14px',
        borderRadius: 999,
        border: 'none',
        background: GLASS_BG,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: GLASS_SHADOW,
        color: 'rgba(255,255,255,0.92)',
        cursor: 'default',
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.08px',
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 28, mass: 0.5 }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 999,
          background: hovered ? 'rgba(255,255,255,0.12)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <span className="relative">Edit</span>
    </motion.button>
  )
}

function NavButton({
  side,
  onClick,
}: {
  side: 'left' | 'right'
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <motion.button
      type="button"
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="absolute flex items-center justify-center focus:outline-none"
      style={{
        top: '50%',
        [side]: 16,
        y: '-50%',
        width: 40,
        height: 40,
        borderRadius: '50%',
        border: 'none',
        background: GLASS_BG,
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        boxShadow: GLASS_SHADOW,
        color: 'rgba(255,255,255,0.92)',
        cursor: 'default',
      }}
      whileHover={{ scale: 1.07 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 600, damping: 28, mass: 0.5 }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 3,
          borderRadius: '50%',
          background: hovered ? 'rgba(255,255,255,0.14)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <span
        aria-hidden
        className="relative inline-flex shrink-0 [&>svg]:block"
        style={{
          width: 20,
          height: 20,
          transform: side === 'left' ? 'scaleX(-1)' : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: chevronRightSvg }}
      />
    </motion.button>
  )
}
