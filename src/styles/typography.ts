/**
 * Shared typography constants.
 *
 * Until this file existed, every component that needed to declare
 * `fontFamily` inline (toolbars, dialogs, sidebars, etc.) shipped a
 * different abbreviated SF Pro stack — 21 distinct redeclarations across
 * `src/`, none of which matched the canonical 9-font stack on `body` in
 * `src/index.css`. That meant fallback behavior on non-Apple platforms
 * (Linux, older Windows) silently diverged per-component.
 *
 * Anywhere a component must redeclare its font-family (e.g. because the
 * element is inside a contenteditable that strips inherited fonts, or
 * because the styling lives in an inline `style={{}}` rather than a
 * class on a child of `body`), import `FONT_STACK` and use that string.
 *
 * Keep this byte-identical to `src/index.css:26-28` `body { font-family }`.
 *
 * `DISPLAY_FONT_STACK` is intentionally distinct: it's the Display-first
 * variant for marquee headings (LockScreen clock, Photos grid date header)
 * where the slightly tighter optical sizes are deliberate. Don't use it for
 * body or UI chrome.
 */

import type { CSSProperties } from 'react'

export const FONT_STACK =
  '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'

export const DISPLAY_FONT_STACK =
  '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'

/**
 * The single titled-window rule. Every window that paints its own name in
 * the title bar / unified toolbar (Notes, Photos, Roblox Studio) spreads
 * this so the system reads as one app family rather than three slightly
 * different title treatments.
 *
 * Value matches Apple's focused-window title in dark mode: SF Pro at 13px,
 * Semibold (600), tight optical letter-spacing, and near-white (0.96) —
 * bright because a focused window's title should be legible, not dimmed.
 * Earlier this drifted (Notes 12/600/#fff, Photos 13/600/0.96, Roblox
 * 13/700/0.55); this is the reconciled rule. Add a subtitle/secondary
 * label separately (Photos/Notes use 11-12px at ~0.4-0.52 alpha).
 */
export const WINDOW_TITLE_STYLE: CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '-0.14px',
  color: 'rgba(255,255,255,0.96)',
}

/**
 * Companion line under `WINDOW_TITLE_STYLE` (note count, date range, etc.).
 * Photos TitlePlate is the precedent: 11 / 500 / 0.52.
 */
export const WINDOW_SUBTITLE_STYLE: CSSProperties = {
  fontFamily: FONT_STACK,
  fontSize: 11,
  fontWeight: 500,
  color: 'rgba(255,255,255,0.52)',
  marginTop: 1,
}
