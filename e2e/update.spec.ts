import { expect, test, type Page } from '@playwright/test'
import { closeAll, freePort, host, launch, masterAndPlayer, type AppHandle } from './helpers'

test.afterEach(closeAll)

interface FakeUpdaterHook {
  emit(event: string, arg?: unknown): boolean
  checks: number
  installs: Array<[boolean, boolean]>
}

/** Makes this app's (fake) updater emit an electron-updater event. */
async function emit(h: AppHandle, event: string, arg?: unknown): Promise<void> {
  await h.app.evaluate((_e, [ev, a]) => {
    const u = (globalThis as unknown as { __mesaUpdater: FakeUpdaterHook }).__mesaUpdater
    u.emit(ev as string, ev === 'error' ? new Error(String(a)) : a)
  }, [event, arg] as const)
  // The push is sent before this reply on the same channel, so the bar has drawn it when this returns.
  await h.page.evaluate(() => window.mesa.updateState())
}

async function installs(h: AppHandle): Promise<Array<[boolean, boolean]>> {
  return h.app.evaluate(() => (globalThis as unknown as { __mesaUpdater: FakeUpdaterHook }).__mesaUpdater.installs)
}

async function downloaded(h: AppHandle, version = '0.2.0'): Promise<void> {
  await emit(h, 'update-available', { version })
  await emit(h, 'download-progress', { percent: 50 })
  await emit(h, 'update-downloaded', { version })
}

async function expectReady(page: Page, version = '0.2.0'): Promise<void> {
  await expect(page.getByTestId('update-bar')).toBeVisible()
  await expect(page.getByTestId('update-text')).toHaveText(`Atualização ${version} pronta`)
  await expect(page.getByTestId('update-install')).toBeVisible()
  await expect(page.getByTestId('update-install')).toHaveText('Reiniciar e atualizar')
}

test('[C4] UPD-04 a newer version shows "Baixando atualização <versão>…" in the top bar while it downloads', async () => {
  const app = await launch()
  await expect(app.page.getByTestId('update-bar')).toBeHidden()
  await emit(app, 'update-available', { version: '0.2.0' })
  await expect(app.page.getByTestId('update-bar')).toBeVisible()
  await expect(app.page.getByTestId('update-text')).toHaveText('Baixando atualização 0.2.0…')
  await expect(app.page.getByTestId('update-install')).toBeHidden()
  await emit(app, 'download-progress', { percent: 42 })
  await expect(app.page.getByTestId('update-text')).toHaveText('Baixando atualização 0.2.0…')
  await expect(app.page.getByTestId('update-install')).toBeHidden()
})

test('[C5] UPD-05 a finished download shows "Atualização <versão> pronta" and "Reiniciar e atualizar", on the start screen and on the table', async () => {
  const port = await freePort()
  const app = await launch()
  await downloaded(app)
  await expect(app.page.getByTestId('host')).toBeVisible() // still the start screen
  await expectReady(app.page)
  // A window that loads after the download still shows it.
  await app.page.reload()
  await app.page.waitForSelector('[data-testid=host]')
  await expectReady(app.page)
  await host(app.page, port)
  await expectReady(app.page)
  await expect(app.page.getByTestId('stop-host')).toBeVisible()
  // The bar sits above the table, not over its top bar.
  const bar = await app.page.getByTestId('update-bar').boundingBox()
  const stop = await app.page.getByTestId('stop-host').boundingBox()
  expect(stop!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height)
  expect(await installs(app)).toEqual([])
})

test('[C6] UPD-06 a player\'s "Reiniciar e atualizar" runs the install at once', async () => {
  const { master, player } = await masterAndPlayer()
  await downloaded(player)
  await expectReady(player.page)
  await player.page.getByTestId('update-install').click()
  await expect.poll(() => installs(player)).toEqual([[false, true]])
  await expect(player.page.getByTestId('update-confirm')).toBeHidden()
  expect(await installs(master)).toEqual([])
})

test('[C7] UPD-07 while hosting, "Reiniciar e atualizar" asks "Reiniciar encerra a mesa para todos. Continuar?" and only "sim" installs', async () => {
  const { master, player } = await masterAndPlayer()
  await downloaded(master)
  await master.page.getByTestId('update-install').click()
  await expect(master.page.getByTestId('update-confirm')).toBeVisible()
  await expect(master.page.getByTestId('update-confirm')).toContainText('Reiniciar encerra a mesa para todos. Continuar?')
  await master.page.getByTestId('update-confirm-no').click()
  await expect(master.page.getByTestId('update-confirm')).toBeHidden()
  await expect(master.page.getByTestId('table')).toBeVisible()
  await expect(master.page.getByTestId('player')).toHaveText(['Mestre', 'Ana'])
  await expect(player.page.getByTestId('status-message')).toHaveCount(0)
  expect(await installs(master)).toEqual([])

  await master.page.getByTestId('update-install').click()
  await master.page.getByTestId('update-confirm-yes').click()
  await expect.poll(() => installs(master)).toEqual([[false, true]])
})

test('[C8] UPD-08 after the master confirms the restart the player sees "O mestre encerrou a mesa"', async () => {
  const { master, player } = await masterAndPlayer()
  await downloaded(master)
  await master.page.getByTestId('update-install').click()
  await master.page.getByTestId('update-confirm-yes').click()
  await expect(player.page.getByTestId('status-message')).toHaveText('O mestre encerrou a mesa')
  await expect.poll(() => installs(master)).toEqual([[false, true]])
  expect(await master.app.evaluate(() => (globalThis as unknown as { __mesaServer: unknown }).__mesaServer)).toBeNull()
})

test('[C11] UPD-11 the same or an older version shows no bar', async () => {
  const app = await launch()
  expect(await app.app.evaluate(() => (globalThis as unknown as { __mesaUpdater: FakeUpdaterHook }).__mesaUpdater.checks)).toBe(1)
  await emit(app, 'update-not-available', { version: '0.1.0' })
  await expect(app.page.getByTestId('update-bar')).toBeHidden()
  expect(await app.page.evaluate(() => window.mesa.updateState())).toEqual({ phase: 'idle' })
})

test('[C12] UPD-12 a failed check or download shows no bar and the app keeps working', async () => {
  const app = await launch()
  await emit(app, 'error', 'net::ERR_INTERNET_DISCONNECTED')
  await expect(app.page.getByTestId('update-bar')).toBeHidden()
  await emit(app, 'update-available', { version: '0.2.0' })
  await expect(app.page.getByTestId('update-text')).toHaveText('Baixando atualização 0.2.0…')
  await emit(app, 'error', 'download interrupted')
  await expect(app.page.getByTestId('update-bar')).toBeHidden()
  await host(app.page, await freePort())
  await expect(app.page.getByTestId('player')).toHaveText(['Mestre'])
})
