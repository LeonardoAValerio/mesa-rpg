import { app, BrowserWindow } from 'electron'
import { join } from 'node:path'
import { registerIpc } from './ipc'

// Tests run several app instances side by side, each with its own profile and cache.
if (process.env.MESA_TEST === '1' && process.env.MESA_USER_DATA) app.setPath('userData', process.env.MESA_USER_DATA)

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1280,
    minHeight: 720,
    title: 'Mesa RPG',
    backgroundColor: '#14161a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(__dirname, '../renderer/index.html'))
}

/** VER-01: the app version; under MESA_TEST, MESA_VERSION stands in so tests can run two versions side by side. */
const version = process.env.MESA_TEST === '1' && process.env.MESA_VERSION ? process.env.MESA_VERSION : app.getVersion()

void app.whenReady().then(() => {
  registerIpc(version)
  createWindow()
})
app.on('window-all-closed', () => app.quit())
