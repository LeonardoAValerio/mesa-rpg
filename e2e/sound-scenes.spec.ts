import { expect, test, type Page } from '@playwright/test'
import { rmSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import { campaignDir, closeAll, freePort, host, join, launch, nextOpenDialog, putFile, showPanel, type AppHandle } from './helpers'
import { toneWav } from './fixtures'

test.afterEach(closeAll)

type Snap = ReturnType<NonNullable<Window['__mesaTest']>['sound']>
async function sound(page: Page): Promise<Snap> {
  await page.waitForFunction(() => !!window.__mesaTest)
  return page.evaluate(() => window.__mesaTest!.sound())
}
const item = (page: Page, name: string) => page.getByTestId('sound-item').filter({ has: page.getByTestId('sound-name').getByText(name, { exact: true }) })
const TAVERNA = 'musicas/taverna.wav'
const BATALHA = 'musicas/batalha.wav'

/** Master and Ana, with two 30-second musics in the campaign. */
async function table(): Promise<{ master: AppHandle; ana: AppHandle; hash: Record<string, string> }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  putFile(master, TAVERNA, toneWav(30, 392))
  putFile(master, BATALHA, toneWav(30, 587))
  const hash: Record<string, string> = {}
  await expect.poll(async () => {
    for (const s of (await master.page.evaluate(() => window.mesa.campaign()))?.sounds ?? []) hash[s.path] = s.hash
    return !!(hash[TAVERNA] && hash[BATALHA])
  }, { timeout: 5000 }).toBe(true)
  const ana = await launch()
  await join(ana.page, port, 'Ana')
  await showPanel(master.page, 'sons')
  return { master, ana, hash }
}
async function saveScene(page: Page, name: string): Promise<void> {
  await showPanel(page, 'mapas')
  await page.getByTestId('save-scene').click()
  await page.getByTestId('scene-name').fill(name)
  await page.getByTestId('scene-name-ok').click()
  await expect(page.getByTestId('scene-item').filter({ hasText: name })).toBeVisible({ timeout: 5000 })
  await showPanel(page, 'sons')
}
async function loadScene(page: Page, name: string): Promise<void> {
  await showPanel(page, 'mapas')
  await page.getByTestId('scene-item').filter({ hasText: name }).click()
  await showPanel(page, 'sons')
}
/** Each live layer of a window as [hash, gain rounded to 2 places]. */
const live = async (page: Page): Promise<Array<[string, number]>> =>
  (await sound(page)).layers.filter((l) => !l.stopping && l.playing).map((l) => [l.hash, Math.round(l.gain * 100) / 100] as [string, number]).sort()

test('[C26] SOM-26 loading a scene fades out the layers not in it and plays its own at the scene\'s volume, in every window', async () => {
  const { master, ana, hash } = await table()
  await item(master.page, 'taverna').click()
  await master.page.getByTestId('layer-volume').fill('60')
  await saveScene(master.page, 'Taverna')
  // the table moves on: battle music on, the tavern loud
  await item(master.page, 'batalha').click()
  await master.page.getByTestId('layer').filter({ hasText: 'taverna' }).getByTestId('layer-volume').fill('100')
  await expect.poll(() => live(ana.page), { timeout: 6000 }).toEqual([[hash[BATALHA], 1], [hash[TAVERNA], 1]].sort())
  await loadScene(master.page, 'Taverna')
  // both windows at once: the battle fades (not cut), the tavern drops to 60, then only the tavern is left
  await Promise.all([master.page, ana.page].map((page) => expect.poll(async () => (await sound(page)).layers.find((l) => l.hash === hash[BATALHA])?.stopping, { timeout: 1500, intervals: [50] }).toBe(true)))
  for (const page of [master.page, ana.page]) {
    await expect.poll(() => live(page), { timeout: 3000 }).toEqual([[hash[TAVERNA], 0.6]])
    await expect.poll(async () => (await sound(page)).layers.map((l) => l.hash), { timeout: 3000, intervals: [100] }).toEqual([hash[TAVERNA]])
  }
  await expect(master.page.getByTestId('layer-name')).toHaveText(['taverna'])
})

test('[C27] SOM-27 loading a scene with no layers fades every layer out', async () => {
  const { master, ana } = await table()
  await saveScene(master.page, 'Silêncio')
  await item(master.page, 'taverna').click()
  await item(master.page, 'batalha').click()
  await expect.poll(async () => (await live(ana.page)).length, { timeout: 6000 }).toBe(2)
  await loadScene(master.page, 'Silêncio')
  await Promise.all([master.page, ana.page].map((page) => expect.poll(async () => { const l = (await sound(page)).layers; return l.length === 2 && l.every((x) => x.stopping) }, { timeout: 1500, intervals: [50] }).toBe(true)))
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers, { timeout: 3000, intervals: [100] }).toEqual([])
})

test('[C28] SOM-28 a scene whose music file is gone does not load and shows "Arquivo não encontrado: <caminho>"', async () => {
  const { master, ana, hash } = await table()
  await item(master.page, 'taverna').click()
  await saveScene(master.page, 'Taverna')
  await item(master.page, 'taverna').click() // off
  await item(master.page, 'batalha').click()
  rmSync(pathJoin(campaignDir(master), 'musicas', 'taverna.wav'))
  await expect(item(master.page, 'taverna')).toHaveCount(0, { timeout: 2000 })
  await expect.poll(async () => (await live(ana.page)).map(([h]) => h), { timeout: 6000 }).toEqual([hash[BATALHA]])
  await showPanel(master.page, 'mapas')
  await master.page.getByTestId('scene-item').filter({ hasText: 'Taverna' }).click()
  await expect(master.page.getByTestId('scene-message')).toHaveText('Arquivo não encontrado: musicas/taverna.wav')
  await master.page.waitForTimeout(500)
  expect((await live(ana.page)).map(([h]) => h)).toEqual([hash[BATALHA]]) // nothing changed
})

test('[C29] SOM-29 importing a .mesa keeps the layers playing', async () => {
  const { master, ana, hash } = await table()
  await item(master.page, 'taverna').click()
  await expect.poll(async () => (await live(ana.page)).map(([h]) => h), { timeout: 6000 }).toEqual([hash[TAVERNA]])
  const out = pathJoin(campaignDir(master), '..', 'mesa-som.mesa')
  await master.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, out)
  await showPanel(master.page, 'mapas')
  await master.page.getByTestId('export-mesa').click()
  await expect(master.page.getByTestId('scene-message')).toHaveText('')
  await nextOpenDialog(master.app, [out])
  await master.page.getByTestId('import-mesa').click()
  await master.page.waitForTimeout(1500)
  for (const page of [master.page, ana.page]) expect((await live(page)).map(([h]) => h)).toEqual([hash[TAVERNA]])
  expect((await sound(ana.page)).layers.some((l) => l.stopping)).toBe(false)
})
