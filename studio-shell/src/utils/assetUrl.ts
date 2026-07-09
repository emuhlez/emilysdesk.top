/// <reference types="vite/client" />
/**
 * Resolve a path to a public asset (icons, prompts, etc.) so it works in dev and production.
 * In production (e.g. GitHub Pages at /studio-shell/) assets must be relative to the app base.
 */
export function publicUrl(path: string): string {
  const base = import.meta.env.BASE_URL
  const normalized = path.startsWith('/') ? path.slice(1) : path
  return `${base}${normalized}`
}
