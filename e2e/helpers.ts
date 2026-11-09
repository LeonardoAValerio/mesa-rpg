import { _electron as electron, expect, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'

export interface AppHandle {
  app: ElectronApplication
  page: Page
  userData: string
}

const open: AppHandle[] = []

/** Starts one app instance with its own profile, as a second PC would have. */
export async function launch(opts: { ifaces?: string[] } = {}): Promise<AppHandle> {
  const userData = mkdtempSync(pathJoin(tmpdir(), 'mesa-e2e-'))
  const env: Record<string, string> = { ...(process.env as Record<string, string>), MESA_TEST: '1', MESA_USER_DATA: userData }
  delete env.ELECTRON_RUN_AS_NODE // set by VS Code terminals; it turns Electron into plain Node
  if (opts.ifaces) env.MESA_TEST_IFACES = JSON.stringify(opts.ifaces)
  const app = await electron.launch({ args: [pathJoin(__dirname, '..')], env })
  const page = await app.firstWindow()
  await page.waitForSelector('[data-testid=host]')
  const handle = { app, page, userData }
  open.push(handle)
  return handle
}

export async function closeAll(): Promise<void> {
  for (const h of open.splice(0)) await h.app.close().catch(() => {})
}

export async function freePort(): Promise<number> {
  const s = createServer()
  await new Promise<void>((r) => s.listen(0, '0.0.0.0', () => r()))
  const port = (s.address() as { port: number }).port
  await new Promise<void>((r) => s.close(() => r()))
  return port
}

export async function host(page: Page, port: number): Promise<void> {
  await page.getByTestId('host-port').fill(String(port))
  await page.getByTestId('host').click()
  await expect(page.getByTestId('table')).toBeVisible()
}

export async function join(page: Page, port: number, name: string): Promise<void> {
  await page.getByTestId('join-ip').fill('127.0.0.1')
  await page.getByTestId('join-port').fill(String(port))
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join').click()
  await expect(page.getByTestId('table')).toBeVisible()
}

/** Master and one player ("Ana") on a free port. */
export async function masterAndPlayer(name = 'Ana'): Promise<{ master: AppHandle; player: AppHandle; port: number }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  const player = await launch()
  await join(player.page, port, name)
  return { master, player, port }
}
