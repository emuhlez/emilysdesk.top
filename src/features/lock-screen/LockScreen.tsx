import { useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { DISPLAY_FONT_STACK } from '../../styles/typography'

/**
 * macOS-style lock screen. Visually identical to the inline splash in
 * `index.html` (same `/wallpaper.jpg`, same dim overlay, same date/time
 * layout) so the handoff from "instant inline paint" to "React-owned overlay"
 * is invisible to the user.
 *
 * Click anywhere → calls `onUnlock()`. The fade-out + lift transition is
 * driven by a CSS `transition` triggered by the `exiting` flag we set on
 * click. The component unmounts itself only after the CSS transition has
 * actually finished, by listening for the outer `onTransitionEnd` (filtered
 * to the `opacity` property so it fires once even though we transition
 * opacity/transform/filter together). A `setTimeout(EXIT_MS + 120ms)`
 * serves as a defensive fallback for environments where transitionend
 * doesn't fire — tab backgrounded, prefers-reduced-motion CSS overrides,
 * etc. — so the user is never stuck on the lock screen.
 *
 * Why not just `setTimeout(onUnlock, EXIT_MS)` (the previous implementation):
 * if React's commit cycle is busy (the SVG Liquid Glass filter chain takes
 * a measurable amount of work to apply), the CSS transition can start a
 * frame or two after the timer was scheduled, which clips the tail end of
 * the fade. transitionend is anchored to the actual transition lifecycle
 * and so is robust against that.
 *
 * We use a plain <div> (not motion.div) for the outer wrapper because
 * framer-motion's motion.div was eating the click event in this layout.
 */

const WALLPAPER_URL = '/wallpaper.jpg'
const EXIT_MS = 500

// Fixed SVG canvas for the clock. Wide enough to hold any HH:MM at
// `fontSize: 160` SF Pro Display Semibold (the widest realistic time
// "12:38" measures ≈ 400px), tall enough for the `line-height: normal`
// line box (160 × 1.22 ≈ 196px). The visible glyphs are centered inside
// via `text-anchor="middle"` / `dominantBaseline="central"`, so the
// container is wider than the glyphs but never wraps or clips them.
const CLOCK_SVG_W = 600
const CLOCK_SVG_H = 220

/**
 * Tracks the lock-screen clock SVG's offset within the viewport. The
 * liquid-glass filter's `<feImage>` loads `/wallpaper.jpg` directly (no
 * dim overlay, no `cover` scaling — those happen on the parent's CSS
 * background, which `<feImage>` bypasses). To make the refracted
 * wallpaper line up with the CSS background that's actually behind the
 * clock, we render the image at `(-svgLeft, -svgTop)` with
 * `width = window.innerWidth`, `height = window.innerHeight`, and
 * `preserveAspectRatio="xMidYMid slice"` (the SVG-attribute equivalent
 * of CSS `background-size: cover` + `background-position: center`).
 *
 * Re-measured on mount, on window resize, and whenever `now` ticks (in
 * case the date-row above the clock changed width across month
 * boundary, which would shift the centered clock horizontally).
 */
function useViewportRefraction(
  ref: React.RefObject<SVGSVGElement | null>,
  deps: unknown[],
) {
  const [bbox, setBbox] = useState(() => ({
    x: 0,
    y: 0,
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  }))
  useEffect(() => {
    const update = () => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setBbox({
        x: -r.left,
        y: -r.top,
        w: window.innerWidth,
        h: window.innerHeight,
      })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return bbox
}

function formatLockDate(d: Date): string {
  return d
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
}

function formatLockTime(d: Date): string {
  // 12-hour, no AM/PM — matches the macOS lock screen ("12:36", not "12:36 PM").
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function useLiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    // Align to the next minute boundary, then tick every 60s. Cheaper than
    // ticking every second and the lock screen only shows HH:MM.
    const msToNextMinute = 60_000 - (Date.now() % 60_000)
    let interval: ReturnType<typeof setInterval> | null = null
    const timeout = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), 60_000)
    }, msToNextMinute)
    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
  }, [])
  return now
}

export function LockScreen({ locked, onUnlock }: { locked: boolean; onUnlock: () => void }) {
  const now = useLiveClock()
  const reduceMotion = useReducedMotion()
  const clockSvgRef = useRef<SVGSVGElement>(null)
  const refraction = useViewportRefraction(clockSvgRef, [now])

  // Local "exiting" flag so we can play the CSS fade before the parent
  // unmounts us. We tell the parent to flip `locked = false` only after the
  // transition has finished — see `handleTransitionEnd` below.
  const [exiting, setExiting] = useState(false)
  const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleUnlock = () => {
    if (exiting) return
    setExiting(true)
    // Defensive fallback: if `transitionend` never fires (tab backgrounded,
    // CSS overrides zeroing the duration, etc.) the user must still get
    // through to the desktop. EXIT_MS + 120ms gives the transition every
    // chance to complete on its own first.
    fallbackRef.current = setTimeout(() => {
      fallbackRef.current = null
      onUnlock()
    }, EXIT_MS + 120)
  }

  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (!exiting) return
    // We transition opacity, transform, and filter together with the same
    // duration; listen for opacity only so this handler fires exactly once
    // per unlock, regardless of which property's transition completes last.
    if (e.propertyName !== 'opacity') return
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current)
      fallbackRef.current = null
    }
    onUnlock()
  }

  useEffect(() => {
    return () => {
      if (fallbackRef.current) clearTimeout(fallbackRef.current)
    }
  }, [])

  if (!locked) return null

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Click anywhere to enter"
      onClick={handleUnlock}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleUnlock()
        }
      }}
      onTransitionEnd={handleTransitionEnd}
      className="fixed inset-0 z-[60] flex flex-col items-center cursor-pointer select-none"
      style={{
        backgroundImage: [
          'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.45) 100%)',
          `url('${WALLPAPER_URL}')`,
        ].join(','),
        backgroundSize: 'cover, cover',
        backgroundPosition: 'center, center',
        color: '#fff',
        paddingTop: 'env(safe-area-inset-top)',
        fontFamily: DISPLAY_FONT_STACK,
        opacity: exiting ? 0 : 1,
        transform: exiting && !reduceMotion ? 'scale(1.02)' : 'scale(1)',
        filter: exiting && !reduceMotion ? 'blur(8px)' : 'none',
        transition: `opacity ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1), transform ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1), filter ${EXIT_MS}ms cubic-bezier(0.32, 0.72, 0, 1)`,
      }}
    >
      <div
        style={{
          marginTop: 44,
          fontSize: 25,
          fontWeight: 500,
          letterSpacing: '0.01em',
          opacity: 0.95,
        }}
      >
        {formatLockDate(now)}
      </div>
      {/*
        Liquid Glass clock — Apple iOS 26 / macOS Tahoe 26 behavior,
        applied to the Figma `8007:1666` glyph geometry (SF Pro Display
        Semibold, plus the locked-in `lockscreen-glyph-round` corner
        softening that sits between Display and Rounded).

        The static Figma vector at `8007:1666` has no effects on it (just
        `white` @ `fill-opacity=0.3`), but on real iOS 26 / macOS Tahoe
        hardware the clock reads as glass because the wallpaper *behind*
        the digits is refracted/softened through the translucent slab,
        and a dual rim of specular highlights catches the simulated
        light at the inner edges. That runtime firmware behavior is what
        we reproduce here.

        Apple's Liquid Glass material is a 5-primitive recipe:
          (1) blur, (2) vibrancy, (3) refraction (per-pixel displacement —
          this is what differentiates Liquid Glass from frosted glass),
          (4) specular (on rect controls: a DUAL rim — bright at the
          inner top edge, dark at the inner bottom edge), (5) tint.
        Sources: apple.com/newsroom/2025/06 (announcement), HIG "Adopting
        Liquid Glass", and the 9st.me deep teardown of the web-side
        recreation.

        We implement 4 of the 5 verbatim. For the specular layer, we
        ship a SOFTENED single (top-only) inner halo instead of the
        full dual rim. The dual rim was tried and rejected: on rect
        controls it's correct because the rim has horizontal real
        estate to blend across, but on text strokes that are only
        20–30px tall the bright-top + clear-body + dark-bottom triple
        gets crammed into a few pixels of vertical space and reads as
        three stacked layers rather than one cohesive surface — exactly
        the "layering" the user pushed back on. A soft single top halo
        gives the digits a defined edge without inducing the stacked-
        bands artifact.

        REJECTED EXPERIMENTS (do not re-introduce without checking
        with the user — each was tried and pulled):
         - Dual inner rim (bright top + dark bottom): stacked-bands
           artifact on narrow strokes.
         - feSpecularLighting + outer drop-shadow: read as a
           heavy-handed embossed/painted effect; user "wtf undo".
         - Painted vertical gradient via background-clip: text:
           reads as a decal, not glass.
         - Multiple stacked drop-shadows: rejected twice, character
           was painted/heavy.

        Single-source-of-truth rendering: one `<text>` element with two
        chained filters. The outer `<g>` filter (`lockscreen-liquid-glass`)
        does refraction + specular + tint; the inner `<text>` filter
        (`lockscreen-glyph-round`) does the corner softening. Because
        there's only ONE `<text>` element on screen, there is no glyph
        alignment to manage between separately-rasterized engines (the
        earlier `clipPath`-driven approach kept showing a "ghost" of the
        wallpaper refraction shifted vertically off the visible glyphs
        because Chromium's SVG text baseline metrics differ from HTML's
        line-box metrics). Chained-filter semantics: the outer filter's
        SourceAlpha is the alpha *output* of the inner filter, so the
        glass shape inherits the rounded corners by construction.

        Filter pipeline (`lockscreen-liquid-glass`, viewport-sized region):
          1. `<feImage href="/wallpaper.jpg">` — same-origin direct fetch
             of the raw wallpaper, positioned at the SVG's negative
             viewport offset (see `useViewportRefraction`) with
             `preserveAspectRatio="xMidYMid slice"` — the SVG-attribute
             equivalent of CSS `background-size: cover` +
             `background-position: center`. The result lines up with the
             CSS background the user actually sees behind the clock.
          2. `feGaussianBlur stdDeviation="5"` — softens the wallpaper
             behind the glass without erasing it (#1 in Apple's recipe).
             Heavy blur (~22px) is correct for *frosted* glass like
             Apple's older sidebars/popovers; for the lock-screen
             clock, which is the see-through Liquid Glass treatment,
             the blur stays very light so wallpaper colors and shapes
             remain clearly readable through the digits. ≤2 reads as
             undistorted (no glass character); ≥10 starts to smear the
             wallpaper and the "see what's behind" character fades.
          3. `feColorMatrix type="saturate" 1.6` — vibrancy primitive
             (#2 in Apple's recipe). Keeps tinted wallpapers from going
             gray when blurred.
          4. `feColorMatrix * 0.85` — dim multiplier that compensates
             for `<feImage>` bypassing the lock-screen's CSS dim overlay
             (`linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.45))`).
             A pure dim-match would be ~0.676 (`(1 − 0.36) × 1.04`); we
             over-shoot to 0.85 so the wallpaper through the lens reads
             noticeably brighter than the dim-overlay'd wallpaper
             around it ("light pickup" lens character). 1.0 would
             remove the compensation entirely and the patch would
             glow; 0.72 (the prior value) reads slightly darker than
             surrounding wallpaper at the current 0.04 wash level.
          5. `feTurbulence` + `feDisplacementMap` — REFRACTION primitive
             (#3, the differentiator from frosted glass). Generates
             low-frequency fractal noise in viewport space and uses it
             to displace the lightly-blurred wallpaper, producing
             organic per-pixel "lensing" instead of just smoothing.
             Scale 6 paired with the 5px blur — scale should track the
             blur (sharper input → smaller scale, otherwise the
             displacement looks choppy). baseFrequency 0.014 gives
             noise features ~70px wide — wide enough that within any
             single glyph stroke the wallpaper appears coherently bent
             rather than choppy.
          6. `feComposite in2="SourceAlpha" operator="in"` — clip the
             refracted wallpaper to the corner-softened glyph alpha
             (SourceAlpha is the alpha output of the inner
             `lockscreen-glyph-round` filter — chained filters compose).
          7. TINT (#5): `feFlood` white + `feComposite in SourceAlpha`
             at floodOpacity 0.02. Almost entirely clear — only the
             faintest milky trace remains. The soft top halo carries
             the silhouette and the trace tint keeps the body from
             feeling hollow. Range that still works: 0.01–0.06.
             0 reads as outlined glyphs (no body at all); 0.10+ starts
             to feel painted again.
          8. SPECULAR top halo (#4, softened): `feOffset` SourceAlpha
             down by 1.5px, then `feComposite operator="out"` against
             the original alpha — gives the topmost ~1.5px sliver of
             every stroke (where stuff above is empty). `feGaussianBlur
             stdDeviation="1.2"` feathers the sliver into a soft halo,
             then flood white at opacity 0.55 and clip. The feather
             matters: a sharp 0.6px blur at high opacity reads as a
             distinct band floating above the body; a soft 1.2px blur
             at moderate opacity reads as the body itself catching
             light at the top edge. The bottom-rim shadow that pairs
             with this on rect controls is intentionally omitted (see
             header comment).
          9. `feMerge` order: refracted bg → wash → top halo. Halo
             must be last so it's not washed out by the tint.

        Do NOT re-introduce the painted vertical gradient, outer
        drop-shadow stacks, or the dual top-bright/bottom-dark rim
        — all three were tried and rejected. Refraction carries the
        glass character; the soft top halo carries edge definition;
        the trace white wash keeps the body from feeling hollow.

        Spec: assets/figma/lockscreen-clock.spec.md
        Vector reference: assets/figma/lockscreen-clock-8007-1666.svg
      */}
      <svg
        ref={clockSvgRef}
        aria-hidden
        width={CLOCK_SVG_W}
        height={CLOCK_SVG_H}
        style={{ display: 'block', marginTop: -36, overflow: 'visible' }}
      >
        <defs>
          <filter
            id="lockscreen-glyph-round"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="3.1" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 34 -16"
              result="rounded"
            />
            <feComposite in="SourceGraphic" in2="rounded" operator="in" />
          </filter>
          <filter
            id="lockscreen-liquid-glass"
            x={refraction.x}
            y={refraction.y}
            width={refraction.w}
            height={refraction.h}
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={WALLPAPER_URL}
              x={refraction.x}
              y={refraction.y}
              width={refraction.w}
              height={refraction.h}
              preserveAspectRatio="xMidYMid slice"
              result="bg"
            />
            <feGaussianBlur in="bg" stdDeviation="5" result="bgBlur" />
            <feColorMatrix in="bgBlur" type="saturate" values="1.6" result="bgSat" />
            <feColorMatrix
              in="bgSat"
              type="matrix"
              values="0.85 0 0 0 0
                      0 0.85 0 0 0
                      0 0 0.85 0 0
                      0 0 0 1 0"
              result="bgDim"
            />
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.014"
              numOctaves="2"
              seed="7"
              result="refractNoise"
            />
            <feDisplacementMap
              in="bgDim"
              in2="refractNoise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
              result="bgRefracted"
            />
            <feComposite in="bgRefracted" in2="SourceAlpha" operator="in" result="refracted" />
            <feFlood floodColor="white" floodOpacity="0.02" result="tint" />
            <feComposite in="tint" in2="SourceAlpha" operator="in" result="wash" />
            <feOffset in="SourceAlpha" dx="0" dy="1.5" result="srcShiftDown" />
            <feComposite
              in="SourceAlpha"
              in2="srcShiftDown"
              operator="out"
              result="topEdgeRaw"
            />
            <feGaussianBlur in="topEdgeRaw" stdDeviation="1.2" result="topEdgeMask" />
            <feFlood floodColor="white" floodOpacity="0.55" result="topRimColor" />
            <feComposite in="topRimColor" in2="topEdgeMask" operator="in" result="topRim" />
            <feMerge>
              <feMergeNode in="refracted" />
              <feMergeNode in="wash" />
              <feMergeNode in="topRim" />
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#lockscreen-liquid-glass)">
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={DISPLAY_FONT_STACK}
            fontWeight={600}
            fontSize={160}
            fill="#ffffff"
            filter="url(#lockscreen-glyph-round)"
          >
            {formatLockTime(now)}
          </text>
        </g>
      </svg>

      {/* Subtle pulsing "click to enter" hint — fades in after a beat so it
          doesn't compete with the clock on first paint. */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={
          reduceMotion
            ? { opacity: 0.7, y: 0 }
            : { opacity: [0.55, 0.85, 0.55], y: 0 }
        }
        transition={
          reduceMotion
            ? { duration: 0.4, delay: 0.8 }
            : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }
        }
        className="absolute pointer-events-none"
        style={{
          bottom: 'max(48px, env(safe-area-inset-bottom))',
          fontSize: 13,
          fontWeight: 500,
          letterSpacing: '0.02em',
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 2px rgba(0,0,0,0.18)',
        }}
      >
        Click anywhere to continue
      </motion.div>
    </div>
  )
}
