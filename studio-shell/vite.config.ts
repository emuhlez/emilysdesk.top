import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    // Pin to a dedicated port so we don't fight neighboring dev servers —
    // the host shell (./../) uses 5180, studio-ai uses 5173. strictPort
    // makes Vite fail loudly if 3000 is already taken instead of silently
    // drifting to 5174/5175/etc., which would break the iframe URL in
    // ../src/features/roblox-studio/RobloxStudioWindow.tsx (the host
    // iframe defaults to localhost:3000 and reads VITE_STUDIO_SHELL_URL
    // for overrides).
    port: 3000,
    strictPort: true,
    // Bind to IPv4 explicitly so the host-window iframe (and any browser
    // tab opened directly against this port) can reach the server. Without
    // this, Vite has shipped IPv6-only builds on macOS (`[::1]:3000`) and
    // browsers that resolve `localhost` to `127.0.0.1` first will see
    // ERR_CONNECTION_REFUSED on the iframe even though the dev server is
    // alive. Same fix as ../vite.config.ts.
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        gallery: resolve(__dirname, 'component-gallery.html'),
      },
    },
  },
})





