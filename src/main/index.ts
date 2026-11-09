import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'node:path'
import { registerIpc, stopHost } from './ipc'
import { FakeUpdater, startUpdater } from './updater'

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

/**
 * UPD-03: the installed app checks GitHub once on start. Under MESA_TEST a fake updater stands in for
 * electron-updater and runs the packaged path, so e2e can drive its events; nothing is fetched.
 */
function setupUpdater(): void {
  const test = process.env.MESA_TEST === '1'
  const fake = test ? new FakeUpdater() : null
  if (fake) (globalThis as { __mesaUpdater?: FakeUpdater }).__mesaUpdater = fake
  const updater = startUpdater({
    isPackaged: test || app.isPackaged,
    updater: fake ?? autoUpdater,
    stopServer: stopHost,
    onState: (state) => {
      for (const w of BrowserWindow.getAllWindows()) w.webContents.send('mesa:update-state', state)
    }
  })
  ipcMain.handle('mesa:update-state', () => updater.state())
  ipcMain.handle('mesa:update-install', () => updater.install())
}

void app.whenReady().then(() => {
  registerIpc(version)
  createWindow()
  setupUpdater()
})
app.on('window-all-closed', () => app.quit())
