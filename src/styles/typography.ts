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

export const FONT_STACK =
  '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"'

export const DISPLAY_FONT_STACK =
  '"SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif'
