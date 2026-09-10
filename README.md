# emilysdesk.top

A **macOS Tahoe desktop** in the browser: lock screen, wallpaper, menu bar, dock, and apps (Notes, Photos, Messages, Arc, Roblox Studio).

## Run

```bash
npm install
npm run dev:web          # http://127.0.0.1:5180
```

Electron: `npm run dev`. Studio iframe: `npm run dev:studio` or `npm run dev:all` (expects `../ai-native-studio` on `:5173`).

## Architecture

How the shell, stores, and apps fit together: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
