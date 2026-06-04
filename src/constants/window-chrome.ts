/**
 * Shell-level window-chrome constants.
 *
 * Every app window (Notes / Photos / Arc) needs the same notion of "where
 * the dock starts", "where the menu bar ends", and "what's the smallest
 * drag-handle hit target". Until this file existed, each window file
 * re-declared its own `MENU_BAR_H = 28`, `DOCK_H = 70`, `HANDLE = 6`, and
 * `MOBILE_BREAKPOINT = 640` — identical values, but with nothing stopping
 * them from drifting. (Photos in particular had no `MOBILE_BREAKPOINT` at
 * all, so its initial-rect factory always rendered the desktop layout
 * even at sub-560px viewports where it couldn't fit.)
 *
 * Per-app `MIN_W` / `MIN_H` floors are intentionally NOT centralized —
 * Photos needs `560 x 420` for its grid + sidebar layout, Notes needs
 * `300 x 400` for the editor column, Arc needs `300 x 300` to keep the
 * browser viewport usable. Those stay local to each window file.
 */

/** Height of the global menu bar (matches `MenuBar.tsx` rendered height). */
export const MENU_BAR_H = 28

/** Reserved space at the bottom of the desktop for the dock. */
export const DOCK_H = 70

/** Edge/corner hit-region size for window resize handles. */
export const HANDLE = 6

/** Below this viewport width, windows switch to full-bleed mobile layout. */
export const MOBILE_BREAKPOINT = 640

/**
 * Opaque title-bar / unified-toolbar background for dark-mode windows.
 * Notes' toolbar and Roblox Studio's title bar both paint this flat tone
 * over the `#1E1E1E` window body. Centralized so we don't accumulate
 * near-duplicate one-off chrome tones (Roblox previously shipped a lone
 * `#1C1C1E`). Photos' toolbar is intentionally transparent-over-body and
 * does not use this.
 */
export const TITLE_BAR_BG = '#222222'
