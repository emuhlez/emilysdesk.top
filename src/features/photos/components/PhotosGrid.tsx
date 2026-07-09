import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import {
  bucketPhotos,
  filterPhotosBySection,
  usePhotosStore,
  type PhotoItem,
} from '../../../stores/photos-store'
import { FONT_STACK, DISPLAY_FONT_STACK } from '../../../styles/typography'

/* Trackpad pinch gestures and Ctrl+scroll on a mouse wheel both surface as
 * `wheel` events with `event.ctrlKey === true` in Chromium/Electron. The
 * grid's zoom value is *continuous* (1.0..5.0), so we translate each wheel
 * tick into a fractional zoom delta — the visual scale tracks the gesture
 * pixel-by-pixel rather than snapping between the 5 discrete row-height
 * stops. Lower = more sensitive (faster zoom per pinch). 250 was picked so
 * a deliberate ~½-second pinch traverses ~1 full discrete stop. */
const PINCH_DELTA_PER_UNIT = 250

/**
 * Photos accent — macOS system blue, used as the selected-photo outline
 * and (via `rgba(10, 132, 255, ...)` variants in PhotosSidebar.tsx) the
 * active sidebar row gradient. Intentionally distinct from Notes (gold)
 * and Arc (indigo) per design audit Slice 3 — each app carries its own
 * accent identity. The RGB tuple `10, 132, 255` is the source of truth;
 * `#0A84FF` is the hex form used here for solid fills. Don't introduce
 * other "blue-ish" hexes as Photos selection.
 */
const PHOTOS_ACCENT = '#0A84FF'

/* Row-height stops for zoom 1..5 (px). Zoom 1 is the square "contact sheet"
 * (smaller because the appeal is density). Zooms 2..5 grow moderately —
 * the dramatic visual change between zoom stops is *density* (see
 * `RATIO_SUM_BY_ZOOM`), not size, but photos still grow enough that the
 * pinch gesture has continuous visual feedback as it interpolates between
 * adjacent stops. */
const ROW_HEIGHTS = [80, 100, 120, 145, 175] as const

/* Density (target sum of aspect ratios per row) for justified zooms 2..5.
 * Lower number = fewer photos per row = each photo takes more horizontal
 * space. Each stop reads as a distinctly different *layout density*:
 *   zoom 2: ~6 photos / row, zoom 3: ~4, zoom 4: ~2-3, zoom 5: fixed 2.
 * (Zoom 1 is square contact-sheet mode and doesn't use these values for
 * packing — only for the last-row spacer.) */
const RATIO_SUM_BY_ZOOM = [8, 8, 5, 3, 2] as const

function interpolateRowHeight(zoom: number): number {
  const z = Math.max(1, Math.min(5, zoom))
  const lo = Math.floor(z)
  const hi = Math.ceil(z)
  if (lo === hi) return ROW_HEIGHTS[lo - 1]
  const t = z - lo
  return ROW_HEIGHTS[lo - 1] * (1 - t) + ROW_HEIGHTS[hi - 1] * t
}

type Row = {
  items: PhotoItem[]
  ratios: number[]
  totalRatio: number
}

/** Pack a flat list of photos into justified rows. The same algorithm the
 *  pre-Months/Years grid used inline; lifted to a function so each section
 *  in Months/Years view can pack independently (otherwise short months would
 *  share a row with the next month, which breaks the visual section break).
 *  `fixedPerRow` and `targetRatioSum` come from the active zoom level. */
function packRows(
  photos: PhotoItem[],
  fixedPerRow: number | null,
  targetRatioSum: number,
): Row[] {
  const rows: Row[] = []
  let current: Row = { items: [], ratios: [], totalRatio: 0 }
  for (const p of photos) {
    const r = p.width / p.height
    current.items.push(p)
    current.ratios.push(r)
    current.totalRatio += r
    const shouldBreak =
      fixedPerRow != null
        ? current.items.length >= fixedPerRow
        : current.totalRatio >= targetRatioSum
    if (shouldBreak) {
      rows.push(current)
      current = { items: [], ratios: [], totalRatio: 0 }
    }
  }
  if (current.items.length > 0) rows.push(current)
  return rows
}

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

/**
 * Single photo tile + its overlays (video duration, favorite heart).
 * Extracted so the justified-row mode and the uniform-square-grid mode can
 * render the same visual without duplicating the overlay JSX.
 *
 * No hover state. The previous opacity dim on hover was visible through the
 * floating toolbar's translucent glass and through the right-edge scrollbar
 * gutter, which read as the hover effect "bleeding" into the chrome —
 * macOS Photos.app itself doesn't dim photos on cursor hover, so this is
 * the closer match. Selection (click) is still indicated by the blue
 * outline.
 *
 * Sizing is layout-mode dependent and passed in via `style`:
 *  - Justified mode passes `flex: <ratio>` so the tile fills its row slice.
 *  - Square mode passes explicit `width`/`height` so the tile is a true
 *    `rowHeight × rowHeight` square inside a flex-wrap grid.
 */
function PhotoTile({
  photo,
  isSelected,
  onClick,
  style,
  square = false,
  animateLayout = true,
}: {
  photo: PhotoItem
  isSelected: boolean
  onClick: () => void
  style: CSSProperties
  /** When true, the photo is rendered as a true 1:1 square (zoom-1 mode). */
  square?: boolean
  /** When false (e.g. during an active pinch-zoom gesture), framer-motion's
   *  per-tile layout tracking is disabled — the tile snaps to whatever
   *  position/size flex+grid resolve to without an interpolated transform.
   *  This is what keeps pinch zoom feeling 1:1 with the trackpad gesture
   *  rather than perpetually 320 ms behind it. Layout animation is
   *  re-enabled the moment the gesture ends, so the snap-to-integer-stop
   *  shift IS animated, and any subsequent viewMode change still
   *  triggers the photo migration. */
  animateLayout?: boolean
}) {
  /* Each tile is a `motion.div` with `layout` so when the parent grid
   * reorganizes (viewMode → bucketing change, or square↔justified zoom
   * crossover), the SAME tile element migrates from its old screen position
   * to its new one with a single smooth tween rather than unmounting +
   * remounting in place.
   *
   * Photos keep `key={photo.id}` at every call site, so framer-motion can
   * track tile identity across re-parenting (a photo's parent changes from
   * "row 3 of one big section" to "row 1 of section 'April 2026'" — the
   * tile is the same element to framer because the key matched).
   *
   * Transition is split intentionally:
   *  - `layout` runs at 320 ms / cubic-bezier(0.32, 0.72, 0, 1) — long
   *    enough to read as a graceful migration on view-mode swaps (where
   *    photos can travel hundreds of pixels), short enough to not feel
   *    sluggish on incidental layout changes (zoom step).
   *  - All non-layout props (e.g. `outline` color jumping when selection
   *    changes) use the framer default. We deliberately don't add an
   *    opacity fade — that's the previous crossfade approach, and the
   *    user wants the photos themselves to stay visible throughout the
   *    transition.
   */
  /* Video tiles show a pre-rendered poster <img> at rest and only mount a
   * streaming <video> on hover. This keeps the initial grid render cheap — a
   * handful of small JPEGs instead of N decoding <video> elements — so the
   * library appears instantly; the clip is fetched lazily only when the
   * pointer lands on a tile. */
  const [hovered, setHovered] = useState(false)
  return (
    <motion.div
      layout={animateLayout}
      className="relative overflow-hidden"
      style={{
        minWidth: 0,
        cursor: 'default',
        borderRadius: square ? 0 : 3,
        outline: isSelected ? `2.5px solid ${PHOTOS_ACCENT}` : 'none',
        outlineOffset: square ? 0 : -2,
        ...style,
      }}
      transition={{
        layout: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {photo.isVideo && photo.videoSrc ? (
        <>
          <img
            src={photo.poster ?? photo.src}
            alt={photo.alt}
            loading="lazy"
            className="h-full w-full object-cover"
            draggable={false}
          />
          {hovered && (
            <video
              src={photo.videoSrc}
              poster={photo.poster}
              className="absolute inset-0 h-full w-full object-cover"
              muted
              loop
              playsInline
              autoPlay
              preload="auto"
            />
          )}
          {/* Consistent bottom scrim so the duration label sits on the same
           * dark base on every clip — without it the white text reads as a
           * different shade depending on how bright each poster frame is. */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0"
            style={{
              height: '38%',
              background:
                'linear-gradient(to top, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0) 100%)',
            }}
          />
        </>
      ) : (
        <img
          src={photo.src}
          alt={photo.alt}
          loading="lazy"
          className="h-full w-full object-cover"
          draggable={false}
        />
      )}

      {photo.isVideo && photo.duration != null && (
        <div
          className="absolute"
          style={{
            right: 4,
            bottom: 4,
            fontFamily: FONT_STACK,
            fontSize: 10,
            fontWeight: 600,
            color: '#fff',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            letterSpacing: '0.01em',
          }}
        >
          {formatDuration(photo.duration)}
        </div>
      )}

      {photo.favorite && (
        <div className="absolute" style={{ left: 4, bottom: 4 }}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="#fff">
            <path
              d="M8 13.6 C5 11.6 2.2 9.5 2.2 7 A2.8 2.8 0 0 1 8 5.3 A2.8 2.8 0 0 1 13.8 7 C13.8 9.5 11 11.6 8 13.6 Z"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }}
            />
          </svg>
        </div>
      )}
    </motion.div>
  )
}

export function PhotosGrid({ topInset = 0 }: { topInset?: number }) {
  const photos = usePhotosStore((s) => s.photos)
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectedPhotoId = usePhotosStore((s) => s.selectedPhotoId)
  const selectPhoto = usePhotosStore((s) => s.selectPhoto)
  const viewMode = usePhotosStore((s) => s.viewMode)
  const zoom = usePhotosStore((s) => s.zoom)
  const nudgeZoom = usePhotosStore((s) => s.nudgeZoom)
  const snapZoom = usePhotosStore((s) => s.snapZoom)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isPinchingRef = useRef(false)
  /* Mirror of `isPinchingRef` as state, so we can pass the pinching flag
   * down to `PhotoTile` and disable framer-motion's layout tracking during
   * the gesture. The ref exists to track the flag inside the wheel handler
   * without re-rendering on every wheel tick (which would re-render all 56
   * photo tiles 60 times per second). The state ONLY transitions twice per
   * gesture — once on the first tick (false → true) and once after the
   * end-of-gesture debounce (true → false) — so the re-render cost is
   * bounded to two renders per pinch session, not per frame. */
  const [isPinching, setIsPinching] = useState(false)

  /* Wire up trackpad-pinch / Ctrl+wheel zoom. We attach the native event
   * directly (rather than React's `onWheel`) so we can register with
   * `{ passive: false }` and call `preventDefault()` — React's synthetic
   * wheel handler is passive by default and silently no-ops preventDefault.
   * Each tick translates `deltaY` into a fractional zoom delta and pipes it
   * through the store's `nudgeZoom`, giving a continuous (sub-stop) scale
   * that tracks the gesture. When the gesture ends (no wheel events for
   * `PINCH_END_DEBOUNCE_MS`), we call `snapZoom` so the resting state is
   * always one of the 5 defined integer stops — pinch is smooth during the
   * gesture, detent-clean once released, and the existing height/gap
   * transitions animate the snap (since `isPinchingRef` flips back to
   * false, re-enabling the 220 ms row transitions). */
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const PINCH_END_DEBOUNCE_MS = 160
    let pinchEndTimer: number | null = null
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return // plain scroll: let the container scroll normally
      e.preventDefault()
      // Mark active so we can suppress framer-motion's per-tile layout
      // animation during the gesture (during the pinch itself we want
      // photos to follow the gesture frame-by-frame via flex/grid, with
      // zero animation lag — same intent as the previous CSS-transition
      // suppression). The ref drives the wheel handler; the state mirror
      // is what re-renders PhotoTile so it can flip its `layout` prop.
      // We only set the state on the leading edge (so per-tick re-renders
      // are avoided) — and back on the trailing debounce.
      if (!isPinchingRef.current) {
        isPinchingRef.current = true
        setIsPinching(true)
      }
      if (pinchEndTimer != null) window.clearTimeout(pinchEndTimer)
      pinchEndTimer = window.setTimeout(() => {
        isPinchingRef.current = false
        setIsPinching(false)
        snapZoom()
      }, PINCH_END_DEBOUNCE_MS)
      // Pinch apart → deltaY < 0 → zoom in.
      // Pinch together → deltaY > 0 → zoom out.
      nudgeZoom(-e.deltaY / PINCH_DELTA_PER_UNIT)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
      if (pinchEndTimer != null) window.clearTimeout(pinchEndTimer)
    }
  }, [nudgeZoom, snapZoom])

  const filteredPhotos = filterPhotosBySection(photos, selectedSection)
  const isEmpty = filteredPhotos.length === 0

  /* `rowHeight` interpolates continuously between stops so a pinch has
   * frame-by-frame visual feedback. Packing decisions (`TARGET_RATIO_SUM`,
   * `FIXED_PER_ROW`, `isSquareMode`) use the *snapped* integer zoom so the
   * row composition only re-flows at the midpoint between stops, not on
   * every gesture frame. */
  const snappedZoom = Math.round(zoom)
  const rowHeight = interpolateRowHeight(zoom)
  const isSquareMode = snappedZoom <= 1
  /* Gap scales with row height so density-vs-spacing feels consistent. */
  const photoGap = isSquareMode ? 0 : Math.max(2, rowHeight * 0.08)
  const FIXED_PER_ROW = snappedZoom >= 5 ? 2 : null
  const TARGET_RATIO_SUM = RATIO_SUM_BY_ZOOM[snappedZoom - 1]

  /* Bucket the filtered list by ViewMode. For 'all' this is one section
   * with `label === ''` (no header rendered). For 'months'/'years' each
   * section is one calendar period and gets its own header + its own
   * justified-row pack — short months don't bleed into the next month's
   * first row. */
  const sections = bucketPhotos(filteredPhotos, viewMode)

  const photoCount = filteredPhotos.filter((p) => !p.isVideo).length
  const videoCount = filteredPhotos.filter((p) => p.isVideo).length

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="photos-grid-scroll min-h-0 flex-1 overflow-y-auto"
        style={{
          // Drives `::-webkit-scrollbar-track`/`-thumb` margin-top in
          // index.css so the visible scrollbar starts below the floating
          // toolbar instead of running behind it. paddingTop pushes the
          // first photo row clear of the toolbar — only the scrollbar
          // gutter is inset.
          //
          // The bottom inset (`--photos-scrollbar-inset-bottom`) is left at
          // its 0 default in CSS — the photo / video count footer is now
          // an in-flow element at the end of the scrolled content rather
          // than a floating chrome strip, so the scrollbar can run all the
          // way to the bottom edge.
          ['--photos-scrollbar-inset-top']: `${topInset}px`,
          paddingTop: topInset + 4,
          // Horizontal insets come from `scrollbar-gutter: stable both-edges`
          // in index.css, not paddingLeft/Right — that way the gutter on the
          // right (which houses the scrollbar when it appears) is mirrored
          // by an identical empty gutter on the left, so the photo grid is
          // visually centered regardless of whether the scrollbar is
          // currently showing.
        } as CSSProperties}
      >
        {isEmpty && (
          <div
            className="flex h-full flex-col items-center justify-center"
            style={{ gap: 4 }}
          >
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 12,
                fontWeight: 400,
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              No Photos
            </span>
          </div>
        )}
        {/* Sections list — wrapped in <LayoutGroup> so that on viewMode
         *  change, every PhotoTile (each a `motion.div layout` with a
         *  stable `key={photo.id}`) measures its old vs. new screen
         *  position and animates between them. Photos are NOT unmounted
         *  during the swap; they migrate. From the user's POV the photos
         *  themselves are "fixed" (always present, never blink) and the
         *  layout change eases them into their new slots — replacing the
         *  previous opacity crossfade.
         *
         *  Why LayoutGroup (vs. relying on framer's auto root):
         *  - Scopes layout coordination to just this grid. If we ever
         *    add a second motion.layout-using surface elsewhere in
         *    Photos (e.g. an inspector that shows the same tile in a
         *    second pane), they won't accidentally try to share layout.
         *  - Framer's docs explicitly recommend wrapping a list whose
         *    items can re-parent so position tracking stays correct
         *    across DOM tree shuffles (which is exactly what the
         *    months/years bucketing does).
         *
         *  Header/structure animations (date headers fading in/out,
         *  inter-section gaps growing/collapsing) are handled by the
         *  motion children's `layout` measurements as well — when a
         *  header appears between two photos, the photos below it
         *  animate down to make room rather than snapping. */}
        {!isEmpty && (
          <LayoutGroup id="photos-grid">
            <div>
              {sections.map((section, sectionIdx) => {
            // Pre-compute per-section justified rows when not in square mode.
            // Square mode renders one CSS Grid per section directly (cheaper
            // than flex packing and matches the contact-sheet layout).
            const sectionRows = !isSquareMode
              ? packRows(section.photos, FIXED_PER_ROW, TARGET_RATIO_SUM)
              : []
            // Inter-section spacing matches macOS Photos.app: a comfortable
            // gap between months/years so the date-header acts as a natural
            // visual break. No gap below the last section — the photo/video
            // count footer below provides its own padding.
            const isLastSection = sectionIdx === sections.length - 1
            return (
              <div
                key={section.key}
                style={{
                  marginBottom: !isLastSection && section.label ? 28 : 0,
                }}
              >
                {section.label && (
                  /* Date header for Months/Years views. Suppressed in
                   * 'all' mode (label === ''). Top padding shrinks on the
                   * first section so the first header sits just below the
                   * scroll-area's existing topInset padding rather than
                   * doubling up. */
                  <div
                    style={{
                      paddingTop: sectionIdx === 0 ? 4 : 16,
                      paddingBottom: 12,
                      paddingLeft: 4,
                    }}
                  >
                    <h2
                      style={{
                        fontFamily: DISPLAY_FONT_STACK,
                        fontSize: 22,
                        fontWeight: 700,
                        letterSpacing: '-0.4px',
                        color: 'rgba(255,255,255,0.95)',
                        margin: 0,
                        lineHeight: 1.15,
                      }}
                    >
                      {section.label}
                    </h2>
                    {section.sublabel && (
                      <div
                        style={{
                          marginTop: 2,
                          fontFamily: FONT_STACK,
                          fontSize: 12,
                          fontWeight: 500,
                          letterSpacing: 0.1,
                          color: 'rgba(255,255,255,0.55)',
                        }}
                      >
                        {section.sublabel}
                      </div>
                    )}
                  </div>
                )}

                {isSquareMode ? (
                  /* Uniform-square contact-sheet grid at the smallest
                   * zoom. CSS Grid with `auto-fill` + `1fr` packs as many
                   * ≥`rowHeight` columns as fit, then stretches them to
                   * consume the full container width — each row spans
                   * edge-to-edge with no leftover gap. `aspect-ratio: 1`
                   * keeps cells square as columns stretch. Matches macOS
                   * Photos.app's "All Photos" smallest-zoom layout. One
                   * grid per section so each month/year contact-sheet
                   * stays visually self-contained. */
                  <div
                    className="grid"
                    style={{
                      gridTemplateColumns: `repeat(auto-fill, minmax(${rowHeight}px, 1fr))`,
                      gap: 0,
                      alignContent: 'flex-start',
                    }}
                  >
                    {section.photos.map((photo) => (
                      <PhotoTile
                        key={photo.id}
                        photo={photo}
                        isSelected={photo.id === selectedPhotoId}
                        onClick={() => selectPhoto(photo.id)}
                        animateLayout={!isPinching}
                        square
                        style={{ aspectRatio: '1 / 1' }}
                      />
                    ))}
                  </div>
                ) : (
                  sectionRows.map((row, rowIdx) => (
                    <div
                      key={rowIdx}
                      className="flex"
                      style={{
                        gap: photoGap,
                        marginBottom: photoGap,
                        height: rowHeight,
                        /* No CSS transition on the row container itself —
                         * framer-motion's `layout` on each PhotoTile now
                         * owns all zoom + viewMode animation. The previous
                         * CSS-transition + framer-layout combo
                         * double-animated (CSS interpolated row height
                         * over 220 ms while framer tried to
                         * transform-undo the size change), producing a
                         * subtle scale jitter mid-zoom. Letting framer be
                         * the single source of motion truth fixes that. */
                      }}
                    >
                      {row.items.map((photo, i) => (
                        <PhotoTile
                          key={photo.id}
                          photo={photo}
                          isSelected={photo.id === selectedPhotoId}
                          onClick={() => selectPhoto(photo.id)}
                          animateLayout={!isPinching}
                          style={{ flex: row.ratios[i] }}
                        />
                      ))}
                      {/* Spacer for the section's last incomplete row so
                       * its photos render at the correct flex height
                       * instead of stretching to fill leftover space.
                       * Per-section (not just the very last row of the
                       * scroll container) so each month's last row reads
                       * as left-aligned, matching macOS Photos.app. */}
                      {row.totalRatio < TARGET_RATIO_SUM &&
                        rowIdx === sectionRows.length - 1 && (
                          <div
                            style={{
                              flex: TARGET_RATIO_SUM - row.totalRatio,
                              minWidth: 0,
                            }}
                          />
                        )}
                    </div>
                  ))
                )}
              </div>
                )
              })}
            </div>
          </LayoutGroup>
        )}

        {/* Photo / video count caption — in-flow at the end of the scrolled
            content. Matches macOS Photos.app: small muted caption text that
            scrolls with the photos rather than living on a sticky footer
            chrome. Generous vertical padding gives the text breathing room
            once it scrolls into view. */}
        {!isEmpty && (
          <div
            className="flex justify-center"
            style={{
              paddingTop: 32,
              paddingBottom: 24,
            }}
          >
            <span
              style={{
                fontFamily: FONT_STACK,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 0.2,
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
              {videoCount > 0 &&
                `, ${videoCount} ${videoCount === 1 ? 'Video' : 'Videos'}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
