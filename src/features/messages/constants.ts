/**
 * Messages window fill.
 *
 * The window used to be an opaque `#161616`, tuned so the body read at the
 * same tone as the sidebar's flat search well. That gave the app one uniform
 * dark surface, but it also meant the Liquid Glass on the received bubbles
 * had nothing to work with: Apple's material "blurs content behind it and
 * reflects color and light of surrounding content", and blurring a single
 * flat gray returns that same flat gray. The glass was mathematically a
 * no-op.
 *
 * So the body is now translucent over the desktop, the way Arc's window is.
 * `MESSAGES_WINDOW_BG` stays as the base tone that everything is derived
 * from; `MESSAGES_WINDOW_TINT` is that tone at the window's opacity.
 */
export const MESSAGES_WINDOW_BG = '#161616'

/**
 * Opacity is a legibility budget: low enough that the wallpaper reads as
 * color and motion behind the thread, high enough that 15px bubble text
 * stays comfortable over a moving video.
 */
export const MESSAGES_WINDOW_TINT = 'rgba(22, 22, 22, 0.58)'
export const MESSAGES_WINDOW_BACKDROP = 'blur(48px) saturate(180%)'
