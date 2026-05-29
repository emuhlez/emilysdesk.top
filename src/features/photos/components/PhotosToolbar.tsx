import type { CSSProperties, PropsWithChildren, ReactNode } from 'react'
import { Children, Fragment, createContext, useContext, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { FONT_STACK } from '../../../styles/typography'
import infoCircleMediumSvg from '../../../../assets/sf-symbols/info.circle--monochrome--medium.svg?raw'
import heartMediumSvg from '../../../../assets/sf-symbols/heart--monochrome--medium.svg?raw'
import personCropRectangleSvg from '../../../../assets/sf-symbols/person.crop.rectangle--monochrome--medium.svg?raw'
import line3DecreaseSvg from '../../../../assets/sf-symbols/line.3.horizontal.decrease--monochrome--medium.svg?raw'
import ellipsisCircleSvg from '../../../../assets/sf-symbols/ellipsis.circle--monochrome--medium.svg?raw'
import squareAndArrowUpSvg from '../../../../assets/sf-symbols/square.and.arrow.up--monochrome--medium.svg?raw'
import magnifyingglassSvg from '../../../../assets/sf-symbols/magnifyingglass--monochrome--medium.svg?raw'
import chevronRight2MediumSvg from '../../../../assets/sf-symbols/chevron.right.2--monochrome--medium.svg?raw'
import plusMediumSvg from '../../../../assets/sf-symbols/plus--monochrome--medium.svg?raw'
import minusMediumSvg from '../../../../assets/sf-symbols/minus--monochrome--medium.svg?raw'
import {
  ZOOM_MAX,
  ZOOM_MIN,
  filterPhotosBySection,
  usePhotosStore,
  type SidebarSection,
} from '../../../stores/photos-store'

/* ── Responsive-collapse measurements ──
 * Right-cluster widths (px) used to decide which clusters fit in the available
 * toolbar space. Mirrors the collapse-from-right pattern in NotesToolbar so the
 * two windows feel consistent at narrow widths. */
const ZOOM_W = 77          // 2×30 + 1 gap + 16 padding
const VIEW_TABS_W = 240    // 3 tabs × ~76 + 2×6 gap + 16 padding (worst case)
const ICONS_3_W = 108      // 3×30 + 2×1 gap + 16 padding (no dividers)
const SEARCH_W = 46        // 30 + 16 padding
const CHEVRON_W = 46       // matches search button width
const CLUSTER_GAP = 6
const TITLE_W_ESTIMATE = 140 // "Library" + date subtitle, rough upper bound
const TOOLBAR_RIGHT_PADDING = 20
const TOOLBAR_LEFT_PADDING = 12
const SAFETY_BUFFER = 12

/**
 * PhotosToolbar
 *
 * Content-side toolbar zone — title plate + right-aligned tool clusters (zoom,
 * view tabs, info/share/heart, search). Decoupled from the sidebar-side chrome
 * (traffic lights + sidebar toggle), which lives in PhotosSidebarHeader. Each
 * zone has its own drag overlay so they can be styled / repositioned / iterated
 * on independently.
 */

const VIEW_TABS = [
  { id: 'years' as const, label: 'Years' },
  { id: 'months' as const, label: 'Months' },
  { id: 'all' as const, label: 'All Photos' },
]

const SECTION_LABELS: Record<SidebarSection, string> = {
  library: 'Library',
  collections: 'Collections',
  favorites: 'Favorites',
  recents: 'Recently Saved',
  map: 'Map',
  videos: 'Videos',
  screenshots: 'Screenshots',
  people: 'People & Pets',
  deleted: 'Recently Deleted',
  'shared-albums': 'Shared Albums',
  activity: 'Activity',
  'shared-with-you': 'Shared with You',
  'utility-deleted': 'Recently Deleted',
  handwriting: 'Handwriting',
  'utility-recents': 'Recently Saved',
  imports: 'Imports',
  'utility-map': 'Map',
  'all-projects': 'All Projects',
}

function formatDateRange(dates: Date[]): string {
  if (dates.length === 0) return ''
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime())
  const start = sorted[0]
  const end = sorted[sorted.length - 1]
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', opts)
  const endStr = end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })
  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate()
  ) {
    return end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${startStr} – ${endStr}`
}

/* When a `GlassCluster` wraps exactly ONE child button, the cluster paints
 * a hover overlay that fills the whole pill (instead of just the inner
 * 30×30 button rect). To avoid double-tinting (cluster overlay + button
 * overlay both painting on the same pixels), the cluster signals down
 * via context that the inner button should suppress its own overlay.
 *
 * Multi-button clusters set this to `false` and per-button hovers behave
 * as before. Bare clusters (no glass chrome) also opt out — there's no
 * resting pill to fill. */
const SingleClusterHoverContext = createContext(false)

function GlassCluster({
  children,
  style,
  edge = 'soft',
  bare = false,
  dividers = true,
  fadeDividersOnHover = false,
  role,
}: PropsWithChildren<{
  style?: CSSProperties
  edge?: 'soft' | 'strong' | 'none'
  /** When true, render the cluster as a transparent shell (no glass background, no shadow,
   *  no backdrop filter). Used when the cluster sits on top of another glass surface
   *  (e.g. the sidebar) and we don't want a second floating chip layered on top. */
  bare?: boolean
  /** When false, suppress the thin vertical separators between adjacent children. */
  dividers?: boolean
  /** When true, the cluster's inter-child dividers fade to 0 opacity on
   *  cluster hover (transition: opacity 140ms ease). Used by the segmented
   *  zoom +/− pair so the two halves visually merge during hover without
   *  the layout-shifting 36-px swallow-circle hover. Layout is unchanged —
   *  the divider's flex contribution (width + margin) is reserved either
   *  way, only opacity animates. */
  fadeDividersOnHover?: boolean
  /** ARIA role forwarded to the outer container (e.g. "tablist" for the
   *  view-tabs cluster). Default: undefined → no role attribute emitted. */
  role?: string
}>) {
  const [hovered, setHovered] = useState(false)
  const dividerOpacity = fadeDividersOnHover && hovered ? 0 : 1
  /* When the cluster has exactly one child, the cluster IS the button — so
   * the hover overlay should fill the whole pill, not just the inner 30×30
   * rect. We render a pill-sized overlay here and tell the child button to
   * suppress its own overlay via context. Bare clusters opt out (no resting
   * pill to fill = no hover pill that would suddenly appear out of nothing). */
  const fillHover = Children.count(children) === 1 && !bare
  /* macOS Tahoe 26 Liquid-Glass pill tuning.
     - Heavier backdrop (blur 20 / saturate 180%) so the refraction reads as
       glass over content rather than frosted plastic.
     - Lighter, near-flat tint (≤8% white) so colorful photo content shows
       through — the gradient is intentionally subtle, not a glossy "shine."
     - Single hairline highlight at the top edge (single light source from
       above), no bottom inset. Replaces the older 3-layer cake.
     - Tight, two-stop shadow: contact (1px) + soft ambient (8px @ low alpha)
       instead of a single 12px soft cast (Sonoma-era idiom).
     - SVG edge-refraction filter (`photos-lg-edge`) is unchanged — that's the
       Tier 2 piece that gives the pills their actual liquid quality. */
  return (
    <div
      role={role}
      style={{
        // `position: relative` establishes the containing block for the
        // single-child fillHover overlay below. `display: inline-flex`
        // doesn't on its own.
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        // shrink-0 so the cluster itself can never be squeezed by a narrower
        // toolbar — the responsive collapse system (showIconsCluster /
        // showActionsCluster / showOverflow above) is the only thing allowed
        // to remove clusters from the row; flex compression must not.
        flexShrink: 0,
        gap: 1,
        padding: '5px 8px',
        borderRadius: 999,
        background: bare
          ? 'transparent'
          : 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.07) 100%)',
        backdropFilter: bare ? undefined : 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: bare ? undefined : 'blur(20px) saturate(180%)',
        boxShadow: bare
          ? undefined
          : 'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 1px rgba(0,0,0,0.18), 0 6px 14px -8px rgba(0,0,0,0.30)',
        filter: bare
          ? undefined
          : edge === 'strong'
            ? 'url(#photos-lg-edge-strong)'
            : edge === 'soft'
              ? 'url(#photos-lg-edge)'
              : undefined,
        isolation: 'isolate',
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {fillHover && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
            transition: 'background 140ms ease',
            pointerEvents: 'none',
          }}
        />
      )}
      <SingleClusterHoverContext.Provider value={fillHover}>
        {Children.toArray(children).map((child, i) => (
          <Fragment key={i}>
            {i > 0 && dividers && (
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 14,
                  alignSelf: 'center',
                  background: 'rgba(255,255,255,0.14)',
                  borderRadius: 0.5,
                  flexShrink: 0,
                  margin: '0 1px',
                  opacity: dividerOpacity,
                  transition: 'opacity 140ms ease',
                }}
              />
            )}
            {child}
          </Fragment>
        ))}
      </SingleClusterHoverContext.Provider>
    </div>
  )
}

/**
 * Toolbar icon button with a hover overlay.
 *
 * Default shape: the hover overlay is a **pill matching the button rectangle**
 * (`width × height`, `border-radius: min(width, height) / 2`) — it fills the
 * whole button so the hover reads as a confident chip, mirroring the
 * "hover fills the whole button" rule used across the Notes toolbar
 * (see src/features/notes/components/NotesToolbar.tsx). The cluster already
 * owns the rim treatment, so no per-button rim is added.
 *
 * Canonical zoom-pair pattern: the +/− zoom buttons in the Zoom `GlassCluster`
 * use the **default 30×30 pill hover**. The cluster opts in to
 * `fadeDividersOnHover`, so the 1×14 px divider between the two halves
 * fades to 0 opacity (transition 140ms ease) while the pointer is inside
 * the cluster — the two halves visually merge into a single segmented chip
 * during hover and split again on hover-out. Same uniform 30×30 hover as
 * every other toolbar icon, no layout shift (the divider's flex
 * contribution is reserved either way; only opacity animates).
 *
 * Escape hatch (currently unused): callers can still pass `hoverDiameter` to
 * force a centered circular overlay of that exact diameter — e.g. for a
 * future segmented control where the hover does need to consume the divider.
 * Trusted as-is; caller is responsible for fitting it inside the parent
 * cluster's outer height.
 */
function GlassButton({
  onClick,
  children,
  width = 30,
  height = 30,
  hoverDiameter,
  disabled = false,
}: PropsWithChildren<{
  onClick?: () => void
  width?: number
  height?: number
  /** When set, the hover overlay is rendered as a centered circle of this
   *  diameter (in px) instead of a button-rect-filling pill. Used by
   *  segmented controls (zoom +/−) to size the hover wide enough to consume
   *  the inter-button divider. Trusted as-is — caller must fit it inside
   *  the parent cluster's height. When omitted, the hover overlay is a pill
   *  matching the button's outer rectangle. */
  hoverDiameter?: number
  /** When true, the button is non-interactive: glyph dims to ~32% (matching
   *  the disabled SF Symbol opacity used in macOS Photos.app's zoom control),
   *  hover background is suppressed, and click is a no-op. */
  disabled?: boolean
}>) {
  const [hovered, setHovered] = useState(false)
  const isCircle = hoverDiameter !== undefined
  /* When this button is the sole child of a `GlassCluster`, the cluster
   * paints a pill-sized hover overlay covering the whole chip. Suppress
   * the per-button overlay in that case so the two don't double-tint
   * the inner button rect (the layered look the user has rejected). */
  const inFillHoverCluster = useContext(SingleClusterHoverContext)
  const showHover = hovered && !disabled && !inFillHoverCluster
  return (
    <div
      className="flex items-center justify-center"
      style={{
        position: 'relative',
        // width/height set the visual box, but as a flex child the outer div
        // would otherwise be free to compress below those values under
        // main-axis pressure (flex-basis: auto). shrink-0 + min-width/height
        // pin the icon button at its full 30×30 hit target so the toolbar
        // can never collapse it into a sub-30 squished pill.
        flexShrink: 0,
        width,
        height,
        minWidth: width,
        minHeight: height,
        cursor: 'default',
        color: disabled ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.92)',
        zIndex: 2,
      }}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-disabled={disabled || undefined}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          ...(isCircle
            ? {
                top: '50%',
                left: '50%',
                width: hoverDiameter,
                height: hoverDiameter,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
              }
            : {
                // Explicit centered width×height (instead of `inset: 0`) so the
                // hover overlay is structurally pinned to the button's nominal
                // size — never derived from whatever the outer box turned out
                // to render at. With the default 30×30 button this is exactly
                // a 30×30 hover pill.
                top: '50%',
                left: '50%',
                width,
                height,
                transform: 'translate(-50%, -50%)',
                borderRadius: Math.min(width, height) / 2,
              }),
          background: showHover ? 'rgba(255,255,255,0.08)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <div className="relative flex items-center justify-center">{children}</div>
    </div>
  )
}

function TitlePlate({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      className="flex flex-col leading-tight"
      style={{
        minWidth: 0,
        padding: '6px 14px 6px 0',
      }}
    >
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.14px',
          color: 'rgba(255,255,255,0.96)',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontFamily: FONT_STACK,
            fontSize: 11,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.52)',
            whiteSpace: 'nowrap',
            marginTop: 1,
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  )
}

export function PhotosToolbar({
  height,
  onDragStart,
  contentLeftPx,
  windowWidth,
}: {
  height: number
  onDragStart: (e: React.PointerEvent) => void
  /** X position where the content zone begins (i.e. just after the sidebar zone). */
  contentLeftPx: number
  /** Full window width — used for responsive cluster collapse. */
  windowWidth: number
}) {
  const viewMode = usePhotosStore((s) => s.viewMode)
  const setViewMode = usePhotosStore((s) => s.setViewMode)
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const photos = usePhotosStore((s) => s.photos)
  const zoom = usePhotosStore((s) => s.zoom)
  const zoomIn = usePhotosStore((s) => s.zoomIn)
  const zoomOut = usePhotosStore((s) => s.zoomOut)
  const canZoomOut = zoom > ZOOM_MIN
  const canZoomIn = zoom < ZOOM_MAX

  const sectionLabel =
    selectedSection != null ? SECTION_LABELS[selectedSection] : 'Library'
  const filtered = filterPhotosBySection(photos, selectedSection)
  const dateRange = formatDateRange(filtered.map((p) => new Date(p.date)))

  /* ── Responsive collapse decisions (mirrors NotesToolbar's pattern) ──
   * Right-side clusters drop in priority order as the toolbar narrows.
   * Matches macOS Photos.app behavior: the Info / Share / Heart cluster
   * (anchored by the Info button) is the first to collapse, then the
   * secondary Person / Filter / Ellipsis cluster, and finally the View
   * tabs. Zoom + Search are always shown. Whenever anything collapses,
   * an overflow chevron appears so it's clear there are hidden controls. */
  const toolbarWidth =
    windowWidth - contentLeftPx - TOOLBAR_LEFT_PADDING - TOOLBAR_RIGHT_PADDING
  const availForRight = toolbarWidth - TITLE_W_ESTIMATE - SAFETY_BUFFER

  const isLibrary = selectedSection === 'library' || selectedSection === null
  const widthOf = (parts: number[]) =>
    parts.reduce((sum, p) => sum + p, 0) + (parts.length - 1) * CLUSTER_GAP

  let showViewTabs = false
  let showIconsCluster = false
  let showActionsCluster = false
  let showOverflow = false

  // Phase 1: Try to fit everything (no overflow chevron needed).
  const fullParts: number[] = [ZOOM_W]
  if (isLibrary) fullParts.push(VIEW_TABS_W)
  fullParts.push(ICONS_3_W, ICONS_3_W, SEARCH_W)
  if (availForRight >= widthOf(fullParts)) {
    showViewTabs = isLibrary
    showIconsCluster = true
    showActionsCluster = true
  } else {
    // Phase 2: Drop actions cluster (Info/Share/Heart) first; chevron appears.
    const noActionsParts: number[] = [ZOOM_W]
    if (isLibrary) noActionsParts.push(VIEW_TABS_W)
    noActionsParts.push(ICONS_3_W, SEARCH_W, CHEVRON_W)
    if (availForRight >= widthOf(noActionsParts)) {
      showViewTabs = isLibrary
      showIconsCluster = true
      showOverflow = true
    } else {
      // Phase 3: Drop icons cluster (Person/Filter/Ellipsis) too.
      const noIconsParts: number[] = [ZOOM_W]
      if (isLibrary) noIconsParts.push(VIEW_TABS_W)
      noIconsParts.push(SEARCH_W, CHEVRON_W)
      if (availForRight >= widthOf(noIconsParts)) {
        showViewTabs = isLibrary
        showOverflow = true
      } else {
        // Phase 4: Minimal — zoom + search + chevron only (view tabs drop last).
        showOverflow = true
      }
    }
  }

  return (
    <div
      className="pointer-events-none absolute top-0 z-20 flex items-center"
      style={{
        left: contentLeftPx,
        right: 0,
        height,
        paddingRight: 20,
        cursor: 'default',
      }}
    >
      {/* Invisible drag handle. macOS Tahoe's Photos.app toolbar has no
          backing band — the pills float directly over the photo grid, which
          is what Liquid Glass is designed for (backdrop-filter + edge
          refraction read the content moving underneath). We retain a
          transparent layer here purely to capture window-drag pointer events
          across the empty area between pills.

          Why not a sub-frosted band: Sonoma/Sequoia Photos.app used a
          translucent horizontal slab across the top of the window; Tahoe
          removed it so the glass material is the only chrome on the
          toolbar. See Apple Newsroom macOS Tahoe 26 announcement
          ("toolbars… bringing greater focus to a user's content") and the
          Six Colors Tahoe review ("the top toolbar floats without any
          backing frame, meaning that the buttons all distort the
          underlying content as it slides by"). */}
      <div
        className="pointer-events-auto absolute inset-0"
        style={{
          zIndex: 0,
          top: 0,
          left: 12,
          background: 'transparent',
        }}
        onPointerDown={onDragStart}
      />

      <div
        className="pointer-events-none relative z-[1] flex h-full w-full min-w-0 items-center"
        style={{ paddingLeft: 12 }}
      >
        <div
          className="pointer-events-none flex shrink-0 items-center"
        >
          <TitlePlate title={sectionLabel} subtitle={dateRange || undefined} />
        </div>

        <div className="pointer-events-none min-w-0 flex-1" />

        <div
          className="pointer-events-auto flex shrink-0 items-center"
          style={{ gap: 6 }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <GlassCluster fadeDividersOnHover>
            {/* Zoom out / zoom in. Each button uses the default 30×30 pill
                hover. The cluster's standard 1×14 px divider is visible at
                rest, then fades to opacity 0 (transition 140ms ease) while
                the pointer is anywhere inside the cluster, so the two halves
                visually merge into one segmented chip on hover and split
                again on hover-out — without the layout-shifting 36-px
                swallow-circle. Glyphs are real SF Symbol exports (minus /
                plus, monochrome medium) — see assets/sf-symbols/ — to
                comply with the project's use-sf-symbols-only rule. */}
            <GlassButton
              height={30}
              width={30}
              onClick={zoomOut}
              disabled={!canZoomOut}
            >
              <span
                aria-label="Zoom out"
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 18, height: 18 }}
                dangerouslySetInnerHTML={{ __html: minusMediumSvg }}
              />
            </GlassButton>
            <GlassButton
              height={30}
              width={30}
              onClick={zoomIn}
              disabled={!canZoomIn}
            >
              <span
                aria-label="Zoom in"
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 18, height: 18 }}
                dangerouslySetInnerHTML={{ __html: plusMediumSvg }}
              />
            </GlassButton>
          </GlassCluster>

          {showViewTabs && (
            // View-tabs cluster is force-floored to 40 px so its outer glass
            // aligns with the adjacent 30-px-button icon clusters (which
            // resolve to 30 + 2×5 padding = 40). Vertical cluster padding is
            // zero'd here so the inset active chip sits ~6 px inside the
            // cluster top/bottom — matching macOS Tahoe Photos.app's
            // segmented control, where you can see glass above and below
            // the selection chip. Dividers are off because Tahoe's view
            // tabs are text + chip only, no separators.
            //
            // <LayoutGroup> scopes the framer-motion `layoutId` shared-element
            // animation to *just these three tabs*. The active pill is a
            // <motion.div layoutId="photos-view-tabs-pill"> rendered only on
            // the active tab; when `viewMode` changes, framer detects the
            // same layoutId in a new DOM position and animates the pill
            // from the old tab to the new one (spring 480/38 — quick + firm,
            // matches Apple's segmented-control feel, no bounce). No manual
            // position math, no resize listeners — the layout effect handles
            // tab-width changes automatically.
            <GlassCluster
              style={{ minHeight: 40, padding: '0 8px', gap: 4 }}
              dividers={false}
              role="tablist"
            >
              <LayoutGroup id="photos-view-tabs">
                {VIEW_TABS.map((tab) => {
                  const isActive = viewMode === tab.id
                  return (
                    <ViewTab key={tab.id} isActive={isActive} onClick={() => setViewMode(tab.id)}>
                      {tab.label}
                    </ViewTab>
                  )
                })}
              </LayoutGroup>
            </GlassCluster>
          )}

          {showIconsCluster && (
            <GlassCluster dividers={false}>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: personCropRectangleSvg }}
                />
              </GlassButton>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: line3DecreaseSvg }}
                />
              </GlassButton>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: ellipsisCircleSvg }}
                />
              </GlassButton>
            </GlassCluster>
          )}

          {showActionsCluster && (
            <GlassCluster edge="strong" dividers={false}>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: infoCircleMediumSvg }}
                />
              </GlassButton>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: squareAndArrowUpSvg }}
                />
              </GlassButton>
              <GlassButton width={30} height={30}>
                <span
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: heartMediumSvg }}
                />
              </GlassButton>
            </GlassCluster>
          )}

          {showOverflow && (
            <GlassCluster edge="strong">
              <GlassButton width={30} height={30}>
                <span
                  aria-label="More toolbar actions"
                  className="inline-flex shrink-0 [&>svg]:block"
                  style={{ width: 18, height: 18 }}
                  dangerouslySetInnerHTML={{ __html: chevronRight2MediumSvg }}
                />
              </GlassButton>
            </GlassCluster>
          )}

          <GlassCluster edge="strong">
            <GlassButton width={30} height={30}>
              <span
                className="inline-flex shrink-0 [&>svg]:block"
                style={{ width: 18, height: 18 }}
                dangerouslySetInnerHTML={{ __html: magnifyingglassSvg }}
              />
            </GlassButton>
          </GlassCluster>
        </div>
      </div>
    </div>
  )
}

function ViewTab({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean
  onClick: () => void
  children: ReactNode
}) {
  const [hovered, setHovered] = useState(false)
  // Active state reads as an *inset selection chip* on top of the cluster's
  // own Liquid Glass capsule — solid-ish white wash, no top-edge highlight.
  // Anything that re-introduces a top-light gradient or a strong rim here
  // produces the "glass pill inside a glass pill" look that Tahoe Photos.app
  // explicitly does not do.
  //
  // The active pill is a <motion.div> with a shared `layoutId`. When
  // viewMode changes, framer-motion sees the same layoutId in a different
  // DOM position (the new active tab) and animates the pill from the old
  // tab to the new one. This is the slide. The hover overlay stays as a
  // plain <div> (no layout animation needed) so multiple tabs can be
  // hovered briefly during the slide without fighting the layoutId pill.
  const color = isActive || hovered ? '#fff' : 'rgba(255,255,255,0.68)'
  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={0}
      className="relative rounded-full focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,255,255,0.6)]"
      style={{
        cursor: 'default',
        padding: '6px 12px',
        fontFamily: FONT_STACK,
        fontSize: 12,
        letterSpacing: '-0.08px',
        whiteSpace: 'nowrap',
        color,
        // Keep weight constant across active/inactive to prevent the SF Pro
        // metrics shift that would jitter the tab's text width during the
        // slide (the pill is animated; we don't want the text underneath
        // changing width frame-by-frame). Active is conveyed by the pill
        // and the brighter color, not by weight.
        fontWeight: 500,
        transition: 'color 200ms ease',
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !isActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)' }}
        />
      )}
      {isActive && (
        <motion.div
          layoutId="photos-view-tabs-pill"
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.14)',
            boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.10)',
          }}
          transition={{ type: 'spring', stiffness: 480, damping: 38 }}
        />
      )}
      <span className="relative">{children}</span>
    </div>
  )
}
