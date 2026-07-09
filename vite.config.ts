import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isElectron = !!process.env.ELECTRON

// https://vite.dev/config/
export default defineConfig(async () => {
  const plugins: PluginOption[] = [tailwindcss(), react()]

  if (isElectron) {
    const electron = (await import('vite-plugin-electron/simple')).default
    plugins.push(
      electron({
        // Root package.json has "type": "module", which would emit ESM for the main
        // process. ESM `import 'electron'` resolves to the npm path stub; CommonJS
        // `require('electron')` uses Electron's real API. Build main as .cjs.
        // Vite mergeConfig *concatenates* lib.formats arrays, so we must fix after merge.
        main: {
          entry: 'electron/main.ts',
          vite: {
            plugins: [
              {
                name: 'electron-main-cjs-only',
                configResolved(config) {
                  const lib = config.build.lib
                  if (lib && typeof lib === 'object' && Array.isArray(lib.formats)) {
                    lib.formats = ['cjs']
                  }
                },
              },
            ],
            build: {
              lib: {
                entry: 'electron/main.ts',
                formats: ['cjs'],
                fileName: () => 'main.cjs',
              },
            },
          },
        },
        preload: { input: 'electron/preload.ts' },
      }) as PluginOption,
    )
  }

  // Dev-only plugin: serve /api/iframe-check using the Vercel serverless function logic
  if (!isElectron) {
    plugins.push({
      name: 'dev-api-proxy',
      configureServer(server) {
        server.middlewares.use('/api/iframe-check', async (req, res) => {
          try {
            const handler = (await import('./api/iframe-check')).default
            // Collect POST body
            let body = ''
            req.on('data', (chunk: Buffer) => { body += chunk.toString() })
            req.on('end', () => {
              const fakeReq = {
                method: req.method,
                headers: req.headers,
                query: Object.fromEntries(new URL(req.url || '/', 'http://localhost').searchParams),
                body: body ? JSON.parse(body) : {},
              }
              const fakeRes = {
                status(code: number) { res.statusCode = code; return fakeRes },
                setHeader(k: string, v: string) { res.setHeader(k, v) },
                json(data: unknown) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) },
                send(data: string) { res.end(data) },
              }
              handler(
                fakeReq as unknown as Parameters<typeof handler>[0],
                fakeRes as unknown as Parameters<typeof handler>[1],
              )
            })
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
          }
        })
      },
    })
  }

  return {
    base: '/',
    plugins,
    server: {
      // Pin to a dedicated port so we don't fight the sibling `studio-ai`
      // project (which uses 5173). `strictPort` makes Vite fail loudly
      // instead of silently migrating to an alternate port — IPv4 vs IPv6
      // dual-stack collisions on 5173 were causing the browser to land on
      // the wrong project.
      port: 5180,
      strictPort: true,
      // Bind to IPv4 explicitly. With `host` unset, Vite picks one stack
      // non-deterministically and on macOS it has shipped IPv6-only
      // (`[::1]:5180`) builds; browsers resolve `localhost` → `127.0.0.1`
      // first and don't always retry the AAAA record, so the page just
      // refuses to load even though `curl http://[::1]:5180/` works. Pinning
      // to '127.0.0.1' matches what the browser actually dials.
      host: '127.0.0.1',
    },
  }
})
