# emilysdesk.top — architecture and how it was built

A **macOS Tahoe desktop simulator**: wallpaper, lock screen, menu bar, dock, and app windows in React. It runs as a website (`npm run dev:web`, Vite on `127.0.0.1:5180`) and optionally as Electron (`npm run dev`).

There is **no client router** and **no remote database**. Open windows, z-order, and focus live in Zustand. Notes / Photos / Messages persist to `localStorage`.

## Runtime

```
Vite (+ optional Electron main)
  └─ React renderer (src/main.tsx)
       └─ App.tsx
            ├─ Desktop          always mounted
            └─ LockScreen       local useState gate until click-to-unlock
```

`index.html` includes a splash lock clock so the first paint is not blank. React then mounts an equivalent `LockScreen` and owns the unlock transition.

`Desktop` (`src/features/desktop/Desktop.tsx`) is the shell:

1. `Wallpaper`
2. `MenuBar` (name + menus from the focused app in `APP_REGISTRY`)
3. Window stack: `windowOrder` × `APP_REGISTRY[id].windowComponent`
4. `Dock` from `DOCK_ORDER`, plus minimized-window snapshots and Trash

Window **geometry** (position, size, fullscreen, sidebar width) is component-local. Window **lifecycle** (open / close / focus / minimize / fullscreen id) is `src/stores/app-store.ts`.

## App slice (how a window is added)

Precedent: Notes.

| Piece | Path |
|---|---|
| Window | `src/features/<app>/<App>Window.tsx` |
| UI pieces | `src/features/<app>/components/` |
| Domain state | `src/stores/<app>-store.ts` (if it must survive remount) |
| Registration | `APP_REGISTRY` + `DOCK_ORDER` in `src/stores/app-registry.ts` |

Shared, do not fork per app: `TrafficLights`, `useMinimizeAnimation`, `useFitWindowToViewport`, Liquid Glass SVG defs, typography / window-chrome tokens.

Dock-only entries (no `windowComponent`): Finder, Trash. Figma is registered but omitted from `DOCK_ORDER` until it has a surface.

**Roblox Studio** is a window whose content is a cross-origin iframe of the sibling `ai-native-studio` Vite app (`http://127.0.0.1:5173`, override with `VITE_STUDIO_URL`). `studio-shell/` in this repo is the older in-tree editor; live work targets the sibling process.

**Arc** is an in-app browser. Embeddability is gated by `api/iframe-check.ts` (Vercel serverless in prod; Vite middleware in web dev).

## State

| Store | Owns |
|---|---|
| `app-store` | open / minimized / focus / z-order / fullscreen |
| `app-registry` | static catalog + dock order (not Zustand) |
| `notes-store` | notes, folders, selection — **canonical persist + seed** |
| `photos-store` | library selection / view |
| `messages-store` | conversations, draft, send |

Persistence pattern (Notes): debounce ~400ms into `localStorage`, `loadFromStorage()` on init, seed new default titles without clobbering user data.

Lock state is **not** in `app-store`; it is one-shot per page load in `App.tsx`.

## Visual language

Target is **macOS Tahoe 26 / Liquid Glass** (WWDC 2025 “Get to know the new design system”, HIG Materials). Icons are SF Symbols under `assets/sf-symbols/`. Layout is Tailwind; exact radii, fills, and type use inline style tokens (`src/constants/window-chrome.ts`, `src/styles/typography.ts`).

Liquid Glass sits on **controls** (sidebars, toolbars, capsules), not on content (message bubbles stay solid). Concentric radii: inner = parent corner − padding (e.g. window 24px, sidebar inset 10px → sidebar 14px).

## How it was built (history)

Built as a personal desktop (`emilyhopeiscool`, later renamed **emilysdesk.top**) starting **April 2026**.

1. **Shell first** — Vite + React 19 + TypeScript + Tailwind. Desktop, dock, menu bar. No routes.
2. **Arc** — first dense window: tabs, bookmarks, iframe + proxy so third-party pages can sit inside the fake browser.
3. **Notes** — established feature-folder + Zustand + `localStorage` + unified toolbar / traffic lights.
4. **Photos** — library from `public/`, then a Tahoe Liquid Glass sidebar (floating inset glass, scroll-edge).
5. **Lock screen + minimize** — splash clock, genie-style minimize with `html-to-image` dock thumbnails.
6. **Roblox Studio** — window chrome around a live Studio prototype iframe; ports pinned (`5180` host vs `5173` studio) so they do not collide.
7. **Chrome unification** — shared window shadow, type, paddings (design-audit slices).
8. **Messages (Aug 2026)** — iMessage-style thread, WWDC 356 glass (background extension, concentric sidebar, `GlassCluster` toolbar).

Work is agent-assisted in Cursor with project skills: `match-latest-macos-ui`, `use-sf-symbols-only`, `pull-references`, `system-architect`.

## Commands

| Script | What |
|---|---|
| `npm run dev:web` | Browser only, `:5180` |
| `npm run dev` | Electron + Vite |
| `npm run dev:studio` | Sibling `../ai-native-studio` |
| `npm run dev:all` | Host + studio together |
| `npm run build:web` | Static site |

Reference: `src/features/notes/NotesWindow.tsx` + `src/stores/notes-store.ts` (canonical app + store).
