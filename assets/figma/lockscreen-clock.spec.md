# Figma reference: lock-screen clock

Pulled from the **Apple Liquid Glass iOS 26 — Control Center UI Kit (Community)** file.

- File key: `fW4WTybvNjZTCvUGFMlp2J`
- URL: https://www.figma.com/design/fW4WTybvNjZTCvUGFMlp2J/Apple-Liquid-Glass-iOS-26---Control-Center-UI-Kit----Community-

## Primary reference (in use): `8007:1666` — rounded variant

This is the variant the running code targets.

- URL: https://www.figma.com/design/fW4WTybvNjZTCvUGFMlp2J/?node-id=8007-1666
- Node `8007:1666`: `vector` named `12:36`, x=9804, y=8685, **width=1108, height=330**
- Asset: `assets/figma/lockscreen-clock-8007-1666.svg`

### Spec (extracted from the exported vector SVG path attributes)

- **fill**: `white` (`#ffffff`)
- **fill-opacity**: `0.3` → effective 30% translucent.
- **glyph corner radii**: ~20 units in a 330-tall viewBox ≈ **~6% of glyph height**. That sits **between** SF Pro Display (≈4.3%) and SF Pro Rounded (≈10%+). It is *not* pure SF Pro Rounded — confirmed visually by the user.
- **weight**: 700 (Bold) — bumped from Figma's Semibold (600) for a slightly thicker lock-screen clock
- **letter-spacing**: 0
- **line-height**: `normal`
- **No gradient, no drop-shadow, no glow.** The only effect that *is* needed is a corner-softening pass — see "Implementation" below — because the glyph geometry in Figma sits between two installed font variants and can't be produced by any single SF font on macOS.

### Implementation

The "in-between" corner radius can't be hit by swapping fonts:

| Variant | Corner radius (% of glyph height) | Source on macOS |
|---|---|---|
| SF Pro Display Semibold | ~4.3% | `/Library/Fonts/SF-Pro-Display-Semibold.otf` |
| **Figma `8007:1666`** | **~6%** | (target — no exact font match) |
| SF Pro Rounded Semibold | ~10%+ | `/Library/Fonts/SF-Pro-Rounded-Semibold.otf` |

`SFNS.ttf` (the system font reached via `-apple-system`) exposes `wdth`, `opsz` (17–96), `GRAD`, `wght` axes — none of them produce an intermediate Display→Rounded blend. `SF-Pro.ttf` exposes `wdth`, `opsz` (17–28), `wght` only.

The on-spec answer is to keep SF Pro Display geometry and apply a tiny SVG corner-softening filter:

```svg
<filter id="lockscreen-glyph-round" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur" />
  <feColorMatrix in="blur" type="matrix"
    values="0 0 0 0 0
            0 0 0 0 0
            0 0 0 0 0
            0 0 0 34 -16" result="rounded" />
  <feComposite in="SourceGraphic" in2="rounded" operator="in" />
</filter>
```

- `stdDeviation` tracks `≈ fontSize * 0.0125` (e.g. 2.0 at 160px) — lighter than the original in-between Display/Rounded soften (`≈ fontSize * 0.0172`) so corners stay closer to SF Pro Display. Lower than `fontSize * 0.010` is effectively no rounding; higher than `fontSize * 0.022` crosses into SF Pro Rounded territory.
- Current `fontSize` in `LockScreen.tsx` is **180** (hero scale, ~50% of viewport width). The Figma `8007:1666` vector is 1108×330 — true full-bleed hero at the iPad frame — but at our viewport that would force the date row and click hint to fight for room, so we sit one notch back from full hero.
- The alpha re-threshold (slope 34, intercept −16) snaps the blurred alpha back to a crisp edge transition (~0.03 wide). Midpoint sits just under 0.5 to slightly dilate the silhouette and offset the inset from re-thresholding a blurred glyph — strokes stay at native Semibold weight rather than thinning.

### Liquid Glass treatment (DEVIATES FROM static Figma — intentional)

The Figma vector at `8007:1666` is just a flat `white` fill at `fill-opacity=0.3`. It has no effects on it. **But on real iOS 26 / macOS Tahoe hardware the clock reads as glass**, because the wallpaper *behind* the digits is refracted/softened through the translucent slab. Static Figma cannot depict that runtime firmware behavior; the painted flat opacity in the file is a placeholder for it.

So the production implementation deliberately deviates from the static Figma in one direction: it adds the runtime refraction Apple ships, while keeping the Figma's geometry, weight, and corner softening verbatim.

Apple's Liquid Glass material on macOS Tahoe 26 / iOS 26 is a **5-primitive recipe** (sources: apple.com/newsroom/2025/06 announcement, HIG "Adopting Liquid Glass", and the 9st.me web teardown):

1. **Blur** — Gaussian backdrop blur of what's behind the surface.
2. **Vibrancy** — saturation + brightness boost so blurred color stays alive.
3. **Refraction** — *per-pixel displacement* of the blurred backdrop. This is the layer that differentiates Liquid Glass from frosted glass; without it, glass reads as plastic. Apple does this in real-time fragment shaders; on the web it's reproduced via `feTurbulence` + `feDisplacementMap`.
4. **Specular** — a *dual rim*: a bright highlight on the inner top edge plus a darker shadow on the inner bottom edge. This is what gives the slab its sense of thickness. On rect controls Apple ships this as the inset stack `inset 0 2px 4px -2px rgba(255,255,255,0.18)` + `inset 0 -2px 4px -2px rgba(0,0,0,0.25)`.
5. **Tint** — a thin translucent fill (white at low opacity for the default `.regular` material).

For our text-on-wallpaper, we implement 4 of the 5 verbatim and adapt #4. Items 1, 2, 5 are implemented directly. Item 3 is implemented via `feTurbulence` + `feDisplacementMap` on the blurred backdrop. **Item 4 ships as a softened, top-only inner halo** — not the full dual rim.

**Item 4 (specular) iteration history — DO NOT re-introduce these without re-confirming:**

- **A. Dual inset rim** (bright inner-top sliver + dark inner-bottom sliver via two `feOffset` + `feComposite "out"` chains). Visually glassy on rect controls — that's how Apple ships it on buttons / sheets — but on text strokes only 20–30px tall, the bright-top + clear-body + dark-bottom triple got crammed into 4–6 vertical pixels on thin strokes and read as three stacked layers, not one cohesive surface. Reference: `assets/Screenshot_2026-05-26_at_12.41.35_PM-bf30a447-1f4d-4318-a947-a112432e53e6.png`.
- **B. (Current) Softened single top-halo.** Top rim only, wider feather (`stdDeviation=1.5`), stronger opacity (`0.8`), offset (`dy=2`). Doesn't induce the stacking — refraction carries the glass, the halo carries the specular catch.
- **C. `feSpecularLighting` + outer drop-shadow.** The specular primitive simulates actual light over the glyph alpha as a heightmap; the drop-shadow lives OUTSIDE the glyph for slab depth. Pulled — read as a heavy embossed/painted effect rather than glass ("um wtf undo"). Keeping this trail in case the future answer is feSpecularLighting tuned much subtler (lower surfaceScale, lower specularConstant, no drop-shadow).

#### Technique (Option 1: single SVG, single `<text>`, chained filters)

The implementation is a single `<svg>` containing one `<text>` element with two chained filters. There is no second text element on screen and no clipping of one rendering against another — the glass treatment is the rendering. This was specifically chosen to eliminate the glyph-alignment risk that bit the previous `backdrop-filter` + `<clipPath>` approach (Chromium's SVG-text baseline metrics differ from its HTML-text line-box metrics, which produced a visible "ghost" of refracted wallpaper offset vertically from the white-wash glyphs).

Structure:

```
<svg refraction-region=viewport>
  <defs>
    #lockscreen-glyph-round    — locked in-between corner softening (unchanged)
    #lockscreen-liquid-glass   — wallpaper refraction + white wash, viewport-sized region
  </defs>
  <g filter=#lockscreen-liquid-glass>             ← outer: glass effect (uses rounded alpha)
    <text filter=#lockscreen-glyph-round />       ← inner: corner softening on glyph alpha
  </g>
</svg>
```

Chained-filter semantics: when an SVG element has a filter and its parent `<g>` *also* has a filter, the parent's `SourceGraphic` / `SourceAlpha` are the *output* of the child's filter. So the outer `lockscreen-liquid-glass` filter sees the corner-softened glyph alpha as `SourceAlpha`, which is what it composites the refraction against — the glass shape inherits the same rounded corners as the visible text by construction, not by alignment.

Liquid-glass filter primitives (matching the 5-primitive recipe above, in chain order):

1. **Blur source — wallpaper fetch.** `<feImage href="/wallpaper.jpg" preserveAspectRatio="xMidYMid slice">` — direct same-origin fetch of the raw wallpaper. `xMidYMid slice` is the SVG attribute-form of CSS `background-size: cover` + `background-position: center`. The image is positioned at `(-svgLeft, -svgTop, vw, vh)` so that for every SVG user-space coordinate inside the glyph, the feImage pixel rendered at that coordinate is the same pixel that the CSS background renders at that viewport position. This is what makes the refraction line up with the wallpaper visible around the digits.
2. **Blur (#1).** `feGaussianBlur stdDeviation="3"` — softens the wallpaper behind the glass without erasing it. Heavy blur (~22px, the value used through earlier iterations) is correct for *frosted* glass — Apple's older sidebar/popover style — but the lock-screen clock is the see-through Liquid Glass treatment, so the blur stays light. Progression has been 22 → 8 → 5 → 2.5 → 3.
3. **Vibrancy (#2).** `feColorMatrix type="saturate" 2.0` — keeps tinted wallpapers from going gray when blurred; bumped so the lens concentrates surrounding color.
4. **Dim compensation.** `feColorMatrix * 0.95` (4×5 matrix with diagonal `0.95`) — compensates for `<feImage>` bypassing the lock-screen's CSS dim overlay. Over-shoots so the wallpaper through the lens reads brighter ("light pickup" / light-concentrating lens). Progression: 0.72 → 0.85 → 0.9 → 0.95.
5. **Refraction (#3) — per-pixel displacement.** `feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" seed="7"` → soft blur `stdDeviation="1.8"` → `feDisplacementMap scale="9"`. Softening the noise (same trick as Photos `LiquidGlassDefs`) lets scale sit at ~3× the backdrop blur for visibly bent clear glass without chop. Progression has been 14 (blur 22) → 8 (blur 8) → 6 (blur 5) → 5 (blur 2.5) → 9 (blur 3, soft noise).
6. **Refraction clip.** `feComposite in2="SourceAlpha" operator="in"` — clip the refracted wallpaper to the corner-softened glyph alpha (which is the alpha output of the inner `lockscreen-glyph-round` filter via filter chaining).
7. **Tint (#5).** `feFlood floodColor="white" floodOpacity="0.025"` + `feComposite in2="SourceAlpha" operator="in"` — trace milky body, clipped to the corner-softened glyph alpha. Just enough substance for a glass volume without frosting. Progression has been 0.45 → 0.30 → 0.20 → 0.10 → 0.04 → 0.02 → 0.025.
8. **Specular top halo (#4, softened).** `feOffset SourceAlpha dy="2"` shifts the alpha down 2px; `feComposite operator="out"` against the original `SourceAlpha` extracts the topmost ~2px sliver of every stroke. `feGaussianBlur stdDeviation="1.5"` feathers the sliver into a soft halo. Flood white at opacity 0.8, clip. The bottom-rim shadow that pairs with this on rect controls is intentionally omitted.
9. **Composite order.** `feMerge`: refracted bg → wash → top halo. Halo last so the tint doesn't wash it out.

Viewport offset is tracked by the `useViewportRefraction` hook (in `LockScreen.tsx`): a ref + `getBoundingClientRect` + `window.resize` listener, re-running whenever `now` ticks (the date row above the clock might change width on month/day boundary, which would shift the centered clock horizontally and invalidate the previous measurement).

Why **not** the painted vertical gradient (the original treatment):

- That treatment painted a fixed sheen *inside* the glyph and let the wallpaper bleed through via `opacity: 0.5`. Wallpaper detail behind the digits stayed crisp — the same pixels were just darkened. It read as a tinted decal, not glass. Refraction (blur) is what makes glass legible as glass.

Why **not** the previous `backdrop-filter` + `clipPath` approach:

- It worked visually — the refraction itself was correct, and you could see the wallpaper softened through the glyph silhouette. But the `<clipPath>`'s SVG `<text>` element and the visible HTML `<div>` text were rasterized by two different engines with slightly different baseline metrics, and Chromium positioned the clipPath text noticeably higher than the visible text (~22px off at fontSize 180, and the empirical y-offset that closed the gap at one font size broke at others). The "ghost" was visible in saved crops `assets/figma/_compare-glass-v2c-crop.png` and `_compare-glass-v3-crop.png`.

Tunables on the liquid-glass filter:

- `stdDeviation="3"` (blur) — optical thickness. Still clear Liquid Glass; ≥10 smears into frost.
- `saturate 2.0` (vibrancy) — color concentration through the lens.
- `0.95` dim multiplier — light-pickup / light-concentrating lens vs. the CSS dim overlay.
- Softened `feTurbulence baseFrequency="0.01"` + `feGaussianBlur 1.8` + `feDisplacementMap scale="9"` — refraction warp. Soft noise is what allows the higher scale without chop.
- `floodOpacity="0.025"` on the white wash — body translucency (glass volume without frost).
- Top halo `floodOpacity="0.8"`, dy=2px, blur 1.5px — stronger specular catch without dual-rim stacking.
- Bottom inner shadow — intentionally omitted. It's structurally correct for rect controls but produces the stacked-bands artifact on narrow text strokes.
- Outer drop-shadow + `feSpecularLighting` — both tried and pulled (see history above). Don't re-add without explicit user request.

### Accessibility

The SVG is `aria-hidden`. The whole lock screen is a single `role="button"` with `aria-label="Click anywhere to enter"`, so screen-reader users get one announcement for the click-to-unlock affordance. They do not get the current time. This matches the prior behavior and is intentional — if the user actually needs the time, they're in macOS, which has a separate screen-reader-accessible system clock.

### What's still missing vs. the firmware

- We do not currently animate a specular highlight that tracks pointer position. Apple's iOS 26 lock-screen clock does this only when the device is tilted (gyroscope-driven). Skipping is intentional: there's no analogous pointer-tracking on a stationary lock screen, and a per-frame highlight would fight the click-to-unlock affordance.
- During the 500ms exit animation, the lock-screen container is `transform: scale(1.02)` and `filter: blur(8px)`, but the `useViewportRefraction` cache still has the pre-transform `getBoundingClientRect`. The refracted wallpaper goes very slightly out of sync with the surrounding wallpaper during exit. The outer 8px blur on the whole lock screen masks this completely — verified visually — so this is acceptable.

---

## Earlier reference (superseded): `8002:65` / `8002:66`

Kept here for traceability — earlier attempt targeted this node before the user picked the rounder variant `8007:1666`.

- Nodes:
  - `8002:65` — text "11:23", x=11408.25, y=7388.75, w=304, h=153 (full SF Pro Display line-box)
  - `8002:66` — boolean-op `Union` wrapping the text, x=11414, y=7419, w=291.6875, h=93.3125 (tight glyph optical bounding box)
- Asset: `assets/figma/lockscreen-clock-union-8002-66.svg`
- Spec from `get_design_context` on `8002:65`:
  - font-family: SF Pro Display, weight 600 (Semibold), size 128px, line-height normal, color #ffffff, white-space nowrap, content "11:23"
- Fill from Union SVG: `white` @ `fill-opacity="0.4"`
- Corner radii in Union path: ~4 units in a 93.3-tall viewBox ≈ 4.3% of height (natural SF Pro Display Semibold corner softening).

---

## Common rules (apply to either variant)

- The text content is a placeholder (`"11:23"` or `"12:36"`); production must use a live HH:MM clock — keep `useLiveClock` + `formatLockTime` in `LockScreen.tsx`.
- DO NOT ship the exported SVG path as the clock — those are reference geometries, not live clocks.
- DO NOT add painted vertical gradients via `background-clip: text` — that was the rejected previous treatment; it reads as a decal, not glass. Refraction (via the SVG `feImage` + `feGaussianBlur` chain inside `#lockscreen-liquid-glass`) is what carries the glass character.
- DO NOT re-introduce a heavy drop-shadow stack — the user has rejected that twice. A single, very subtle drop-shadow on the slab is acceptable if contrast ever becomes a problem; multiple stacked shadows are not.
- DO NOT add a second `<text>` element to clip or mask against the visible glyphs — that was the technique behind the "ghost" alignment bug. Keep a single `<text>` and stack effects on it via chained filters.
- The `#lockscreen-glyph-round` corner-softening filter is locked in (see "Implementation"). It is applied as the *inner* filter on the `<text>` element, so its output alpha becomes the `SourceAlpha` that the outer `#lockscreen-liquid-glass` filter composites the refraction and wash against. The glass shape inherits the rounded corners by construction.
- Wallpaper carries the perceived readability via the SVG-filter refraction. If a specific wallpaper makes the digits hard to read, bump the white-wash `floodOpacity` (currently `0.45`) toward `0.55–0.60` before considering any other change.

Reference (current): figma.com/design/fW4WTybvNjZTCvUGFMlp2J?node-id=8007-1666
