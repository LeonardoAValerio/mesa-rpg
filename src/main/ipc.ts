import { randomBytes } from 'node:crypto'
import { app, clipboard, ipcMain } from 'electron'
import type { HostResult } from '../preload/api'
import { validatePort } from '../core/session-rules'
import { listAddresses } from './netinfo'
import { startTableServer, type TableServer } from './table-server'

let server: TableServer | null = null

async function stopHost(): Promise<void> {
  const s = server
  server = null
  exposeForTests()
  await s?.close()
}

function exposeForTests(): void {
  if (process.env.MESA_TEST === '1') (globalThis as { __mesaServer?: TableServer | null }).__mesaServer = server
}

export function registerIpc(): void {
  ipcMain.on('mesa:isTest', (e) => {
    e.returnValue = process.env.MESA_TEST === '1'
  })
  ipcMain.handle('mesa:host', async (_e, portText: string): Promise<HostResult> => {
    const check = validatePort(String(portText))
    if (!check.ok) return { ok: false, error: check.error }
    await stopHost()
    const hostToken = randomBytes(24).toString('hex')
    try {
      server = await startTableServer({ port: check.port, host: '0.0.0.0', hostToken })
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
    exposeForTests()
    return { ok: true, port: server.port, hostToken }
  })
  ipcMain.handle('mesa:stopHost', () => stopHost())
  ipcMain.handle('mesa:addresses', () => listAddresses())
  ipcMain.handle('mesa:copy', (_e, text: string) => clipboard.writeText(String(text)))

  // NET-13: closing the app tells every player before the server goes away.
  app.on('before-quit', (e) => {
    if (!server) return
    e.preventDefault()
    void stopHost().finally(() => app.quit())
  })
}
