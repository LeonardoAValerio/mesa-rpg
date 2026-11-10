import { expect, test, type Page } from '@playwright/test'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
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
const CHUVA = 'musicas/chuva.wav'

/** Master and Ana, with two 30-second musics in the campaign. */
async function table(): Promise<{ master: AppHandle; ana: AppHandle; hash: Record<string, string> }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  putFile(master, TAVERNA, toneWav(30, 392))
  putFile(master, BATALHA, toneWav(30, 587))
  putFile(master, CHUVA, toneWav(30, 300))
  const hash: Record<string, string> = {}
  await expect.poll(async () => {
    for (const s of (await master.page.evaluate(() => window.mesa.campaign()))?.sounds ?? []) hash[s.path] = s.hash
    return !!(hash[TAVERNA] && hash[BATALHA] && hash[CHUVA])
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

test('[C26] SOM-26 loading a scene fades out the layers not in it, starts its missing ones and sets those playing to its volume, in every window', async () => {
  const { master, ana, hash } = await table()
  await item(master.page, 'taverna').click()
  await item(master.page, 'chuva').click()
  await master.page.getByTestId('layer').filter({ hasText: 'taverna' }).getByTestId('layer-volume').fill('60')
  await master.page.getByTestId('layer').filter({ hasText: 'chuva' }).getByTestId('layer-volume').fill('40')
  await saveScene(master.page, 'Taverna')
  // the table moves on: rain off, battle on, the tavern loud
  await item(master.page, 'chuva').click()
  await item(master.page, 'batalha').click()
  await master.page.getByTestId('layer').filter({ hasText: 'taverna' }).getByTestId('layer-volume').fill('100')
  await expect.poll(() => live(ana.page), { timeout: 8000 }).toEqual([[hash[BATALHA], 1], [hash[TAVERNA], 1]].sort())
  await expect.poll(async () => (await sound(ana.page)).layers.length, { timeout: 3000 }).toBe(2) // the rain's fade is over
  await loadScene(master.page, 'Taverna')
  const t0 = Date.now()
  // halfway: the battle fading (not cut), the rain rising towards 40 (not there yet)
  await master.page.waitForTimeout(1000 - (Date.now() - t0))
  for (const s of await Promise.all([sound(master.page), sound(ana.page)])) {
    const battle = s.layers.find((l) => l.hash === hash[BATALHA])!
    expect(battle.stopping).toBe(true)
    expect(battle.gain).toBeGreaterThan(0.2)
    expect(battle.gain).toBeLessThan(0.8)
    const rain = s.layers.find((l) => l.hash === hash[CHUVA])!
    expect(rain.playing).toBe(true)
    expect(rain.gain).toBeGreaterThan(0.05)
    expect(rain.gain).toBeLessThan(0.35)
  }
  for (const page of [master.page, ana.page]) {
    await expect.poll(() => live(page), { timeout: 3000 }).toEqual([[hash[CHUVA], 0.4], [hash[TAVERNA], 0.6]].sort())
    await expect.poll(async () => (await sound(page)).layers.map((l) => l.hash).sort(), { timeout: 3000, intervals: [100] }).toEqual([hash[CHUVA], hash[TAVERNA]].sort())
  }
  await expect(master.page.getByTestId('layer-name')).toHaveText(['taverna', 'chuva'])
})

test('[C27] SOM-27 loading a scene with no layers, or one saved before sounds existed, fades every layer out over 2 s', async () => {
  const { master, ana } = await table()
  await saveScene(master.page, 'Silêncio')
  // a 0.7.0 scene: the same file with no "sound" key
  const cenas = pathJoin(campaignDir(master), 'cenas')
  const old = JSON.parse(readFileSync(pathJoin(cenas, 'Silêncio.cena'), 'utf8'))
  delete old.sound
  writeFileSync(pathJoin(cenas, 'Antiga.cena'), JSON.stringify(old))
  for (const scene of ['Silêncio', 'Antiga']) {
    await item(master.page, 'taverna').click()
    await item(master.page, 'batalha').click()
    for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers.filter((l) => l.gain > 0.99).length, { timeout: 8000 }).toBe(2)
    await loadScene(master.page, scene)
    const t0 = Date.now()
    await master.page.waitForTimeout(1000)
    for (const s of await Promise.all([sound(master.page), sound(ana.page)])) {
      expect(s.layers, scene).toHaveLength(2)
      for (const l of s.layers) {
        expect(l.stopping).toBe(true)
        expect(l.gain).toBeGreaterThan(0.2)
        expect(l.gain).toBeLessThan(0.8)
      }
    }
    for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers, { timeout: 2500, intervals: [100] }).toEqual([])
    expect(Date.now() - t0).toBeLessThan(3200)
  }
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
