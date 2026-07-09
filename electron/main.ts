import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged
  ? process.env.DIST
  : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  })

  // Route renderer `window.open(url, '_blank')` calls (e.g. Arc's
  // "Open in browser" escape hatch) to the user's real browser via
  // shell.openExternal, and deny the default in-app BrowserWindow.
  // Without this, those calls spawn a nested in-app window — the
  // opposite of the user's intent. Restrict to http/https so we never
  // hand an arbitrary protocol (file:, etc.) to the OS.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Security: sanitize webview options before they attach
  win.webContents.on('will-attach-webview', (_event, webPreferences) => {
    // Strip any preload scripts injected by web content
    delete webPreferences.preload
    // @ts-expect-error - preloadURL exists at runtime
    delete webPreferences.preloadURL

    // Enforce secure defaults on all webviews
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(process.env.DIST!, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(createWindow)
