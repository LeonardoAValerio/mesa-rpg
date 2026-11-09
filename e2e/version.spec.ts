import { readFileSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { closeAll, freePort, host, launch } from './helpers'

test.afterEach(closeAll)

/** The version in package.json: what app.getVersion() reports for this build. */
const APP_VERSION = (JSON.parse(readFileSync(pathJoin(__dirname, '..', 'package.json'), 'utf8')) as { version: string }).version

async function tryJoin(page: Page, port: number, name: string): Promise<void> {
  await page.getByTestId('join-ip').fill('127.0.0.1')
  await page.getByTestId('join-port').fill(String(port))
  await page.getByTestId('join-name').fill(name)
  await page.getByTestId('join').click()
}

test('[C14] UPD-14 the start screen shows "Versão <versão>" of the app', async () => {
  const { page } = await launch()
  await expect(page.getByTestId('app-version')).toHaveText(`Versão ${APP_VERSION}`)
  const other = await launch({ version: '0.0.9' })
  await expect(other.page.getByTestId('app-version')).toHaveText('Versão 0.0.9')
})

test('[C15] VER-01 a 0.0.9 player joining a master on the app version sees the version message, with IP, port and name kept', async () => {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  const player = await launch({ version: '0.0.9' })
  await tryJoin(player.page, port, 'Ana')
  await expect(player.page.getByTestId('home-error')).toHaveText(
    `Versão diferente da do mestre: mestre ${APP_VERSION}, você 0.0.9. Atualize o app.`
  )
  await expect(player.page.getByTestId('join-ip')).toHaveValue('127.0.0.1')
  await expect(player.page.getByTestId('join-port')).toHaveValue(String(port))
  await expect(player.page.getByTestId('join-name')).toHaveValue('Ana')
  await expect(player.page.getByTestId('table')).toHaveCount(0)
})

test('[C19] VER-05 a player refused for the version is in neither window players list', async () => {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  await expect(master.page.getByTestId('player')).toHaveText(['Mestre'])
  const player = await launch({ version: '0.0.9' })
  await tryJoin(player.page, port, 'Ana')
  await expect(player.page.getByTestId('home-error')).toContainText('Versão diferente da do mestre')
  await expect(player.page.getByTestId('players')).toHaveCount(0)
  await expect(player.page.getByTestId('player')).toHaveCount(0)
  // A same-version player joining afterwards makes the master's list update, so a stale list cannot pass.
  const bia = await launch()
  await tryJoin(bia.page, port, 'Bia')
  await expect(bia.page.getByTestId('player')).toHaveText(['Mestre', 'Bia'])
  await expect(master.page.getByTestId('player')).toHaveText(['Mestre', 'Bia'])
  expect(await master.app.evaluate(() => (globalThis as unknown as { __mesaServer: { players(): string[] } }).__mesaServer.players())).toEqual(['Mestre', 'Bia'])
})
