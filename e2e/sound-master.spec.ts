import { expect, test, type Page } from '@playwright/test'
import { mkdtempSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join as pathJoin } from 'node:path'
import { campaignDir, closeAll, freePort, host, join, launch, nextOpenDialog, putFile, showPanel, type AppHandle } from './helpers'
import { toneWav } from './fixtures'

test.afterEach(closeAll)

type Snap = ReturnType<NonNullable<Window['__mesaTest']>['sound']>
async function sound(page: Page): Promise<Snap> {
  await page.waitForFunction(() => !!window.__mesaTest)
  return page.evaluate(() => window.__mesaTest!.sound())
}
const layerOf = async (page: Page, hash: string) => (await sound(page)).layers.find((l) => l.hash === hash)
const names = (page: Page, section: string) => page.getByTestId(`list-${section}`).getByTestId('sound-name')
const item = (page: Page, name: string) => page.getByTestId('sound-item').filter({ has: page.getByTestId('sound-name').getByText(name, { exact: true }) })

/** Master with the files put in the campaign, Ana joined, both on the Sons tab; returns each file's hash by path. */
async function table(files: Record<string, Buffer>): Promise<{ master: AppHandle; ana: AppHandle; hash: Record<string, string> }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  for (const [p, b] of Object.entries(files)) putFile(master, p, b)
  const hash: Record<string, string> = {}
  await expect.poll(async () => {
    const info = await master.page.evaluate(() => window.mesa.campaign())
    for (const s of info?.sounds ?? []) hash[s.path] = s.hash
    return Object.keys(files).every((p) => hash[p])
  }, { timeout: 5000 }).toBe(true)
  const ana = await launch()
  await join(ana.page, port, 'Ana')
  for (const page of [master.page, ana.page]) await showPanel(page, 'sons')
  return { master, ana, hash }
}
const RAIN = 'musicas/Ambiente/chuva.wav'
const SWORD = 'efeitos/espada.wav'

test('[C1] SOM-01 Sons lists musicas/ under "Músicas" and efeitos/ under "Efeitos" by name, subfolders as groups that open and close', async () => {
  const { master } = await table({ [RAIN]: toneWav(2), 'musicas/batalha.wav': toneWav(2, 330), [SWORD]: toneWav(1) })
  const p = master.page.getByTestId('panel-sons')
  await expect(p.getByTestId('section-musicas').locator('h3')).toHaveText('Músicas')
  await expect(p.getByTestId('section-efeitos').locator('h3')).toHaveText('Efeitos')
  await expect(names(master.page, 'musicas')).toHaveText(['batalha', 'chuva'])
  await expect(names(master.page, 'efeitos')).toHaveText(['espada'])
  const group = master.page.getByTestId('group-musicas-Ambiente')
  await expect(group.locator('summary')).toHaveText('Ambiente')
  await expect(group.getByTestId('sound-name')).toHaveText(['chuva'])
  await group.locator('summary').click()
  await expect(group.getByTestId('sound-name')).toBeHidden()
  await group.locator('summary').click()
  await expect(group.getByTestId('sound-name')).toBeVisible()
})

test('[C2] SOM-02 audio files added, renamed and removed outside the app show in the lists within 2 seconds', async () => {
  const { master } = await table({ [SWORD]: toneWav(1) })
  const dir = campaignDir(master)
  putFile(master, 'musicas/taverna.wav', toneWav(1, 523))
  await expect(names(master.page, 'musicas')).toHaveText(['taverna'], { timeout: 2000 })
  renameSync(pathJoin(dir, 'musicas', 'taverna.wav'), pathJoin(dir, 'musicas', 'porto.wav'))
  await expect(names(master.page, 'musicas')).toHaveText(['porto'], { timeout: 2000 })
  rmSync(pathJoin(dir, 'efeitos', 'espada.wav'))
  await expect(names(master.page, 'efeitos')).toHaveCount(0, { timeout: 2000 })
})

test('[C4] SOM-04 "Adicionar arquivos" copies into Músicas or Efeitos, a repeated name becoming (2)', async () => {
  const { master } = await table({})
  const src = pathJoin(mkdtempSync(pathJoin(tmpdir(), 'mesa-audio-')), 'trovao.wav')
  writeFileSync(src, toneWav(1))
  await nextOpenDialog(master.app, [src])
  await master.page.getByTestId('add-efeitos').click()
  await expect(master.page.getByTestId('add-message-efeitos')).toHaveText('Adicionados: trovao.wav')
  await nextOpenDialog(master.app, [src])
  await master.page.getByTestId('add-efeitos').click()
  await expect(master.page.getByTestId('add-message-efeitos')).toHaveText('Adicionados: trovao (2).wav')
  await nextOpenDialog(master.app, [src])
  await master.page.getByTestId('add-musicas').click()
  await expect(master.page.getByTestId('add-message-musicas')).toHaveText('Adicionados: trovao.wav')
  expect(existsSync(pathJoin(campaignDir(master), 'efeitos', 'trovao (2).wav'))).toBe(true)
  await expect(names(master.page, 'efeitos')).toHaveText(['trovao', 'trovao (2)'])
  await expect(names(master.page, 'musicas')).toHaveText(['trovao'])
})

test('[C6] SOM-06 a click on a music starts it looping in every window, rising from silence over 2 s, and marks it playing', async () => {
  const { master, ana, hash } = await table({ [RAIN]: toneWav(30) })
  await item(master.page, 'chuva').click()
  const t0 = Date.now()
  await expect(item(master.page, 'chuva')).toHaveAttribute('data-playing', 'true')
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await layerOf(page, hash[RAIN]))?.playing, { timeout: 900, intervals: [50] }).toBe(true)
  // halfway through the rise: about half its volume in both windows
  await master.page.waitForTimeout(1000 - (Date.now() - t0))
  const mid = await Promise.all([layerOf(master.page, hash[RAIN]), layerOf(ana.page, hash[RAIN])])
  for (const l of mid) expect(l!.gain).toBeGreaterThan(0.2)
  for (const l of mid) expect(l!.gain).toBeLessThan(0.8)
  await master.page.waitForTimeout(2300 - (Date.now() - t0))
  for (const page of [master.page, ana.page]) {
    const l = (await layerOf(page, hash[RAIN]))!
    expect(l.gain).toBeGreaterThan(0.99) // risen to its volume at 2 s
    expect(l.position).toBeGreaterThan(2)
  }
})

test('[C7] SOM-07 a second click fades the music out over 2 s and stops it in every window; the mark goes', async () => {
  const { master, ana, hash } = await table({ [RAIN]: toneWav(30) })
  await item(master.page, 'chuva').click()
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await layerOf(page, hash[RAIN]))?.gain, { timeout: 6000 }).toBeGreaterThan(0.99)
  await item(master.page, 'chuva').click()
  const t0 = Date.now()
  await expect(item(master.page, 'chuva')).toHaveAttribute('data-playing', 'false')
  // halfway through the fade: about half its volume in both windows, still playing
  await master.page.waitForTimeout(1000 - (Date.now() - t0))
  const mid = await Promise.all([layerOf(master.page, hash[RAIN]), layerOf(ana.page, hash[RAIN])])
  for (const l of mid) expect(l).toMatchObject({ playing: true, stopping: true })
  for (const l of mid) expect(l!.gain).toBeGreaterThan(0.2)
  for (const l of mid) expect(l!.gain).toBeLessThan(0.8)
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers, { timeout: 2500, intervals: [100] }).toEqual([])
  expect(Date.now() - t0).toBeLessThan(3200)
})

test('[C8] SOM-08 the master sees each playing layer with its name and a 0..100 volume starting at 100', async () => {
  const { master } = await table({ [RAIN]: toneWav(5), 'musicas/taverna.wav': toneWav(5, 523) })
  await expect(master.page.getByTestId('playing-list')).toHaveText('Nenhuma música tocando')
  await item(master.page, 'chuva').click()
  await item(master.page, 'taverna').click()
  await expect(master.page.getByTestId('layer-name')).toHaveText(['chuva', 'taverna'])
  for (const s of await master.page.getByTestId('layer-volume').all()) {
    await expect(s).toHaveValue('100')
    await expect(s).toHaveAttribute('min', '0')
    await expect(s).toHaveAttribute('max', '100')
  }
})

test('[C9] SOM-09 a layer volume set by the master reaches every window within 1 s', async () => {
  const { master, ana, hash } = await table({ [RAIN]: toneWav(30) })
  await item(master.page, 'chuva').click()
  await expect.poll(async () => (await layerOf(ana.page, hash[RAIN]))?.gain, { timeout: 6000 }).toBeGreaterThan(0.99)
  await master.page.getByTestId('layer-volume').fill('30')
  for (const page of [ana.page, master.page]) await expect.poll(async () => (await layerOf(page, hash[RAIN]))!.gain, { timeout: 1000 }).toBeCloseTo(0.3, 2)
})

test('[C10] SOM-10 with 8 layers playing another music shows "Máximo de 8 camadas" and starts nothing', async () => {
  const files: Record<string, Buffer> = {}
  for (let i = 1; i <= 9; i++) files[`musicas/m${i}.wav`] = toneWav(1, 200 + i * 20)
  const { master, ana } = await table(files)
  for (let i = 1; i <= 8; i++) await item(master.page, `m${i}`).click()
  await expect(master.page.getByTestId('layer')).toHaveCount(8)
  await item(master.page, 'm9').click()
  await expect(master.page.getByTestId('sound-message')).toHaveText('Máximo de 8 camadas')
  await expect(item(master.page, 'm9')).toHaveAttribute('data-playing', 'false')
  await master.page.waitForTimeout(500)
  expect((await sound(ana.page)).layers.length).toBe(8)
  await expect(master.page.getByTestId('layer')).toHaveCount(8)
})

test('[C11] SOM-11 "Parar tudo" fades every layer out over 2 s and stops it in every window', async () => {
  const { master, ana } = await table({ [RAIN]: toneWav(30), 'musicas/taverna.wav': toneWav(30, 523) })
  await item(master.page, 'chuva').click()
  await item(master.page, 'taverna').click()
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers.filter((l) => l.gain > 0.99).length, { timeout: 6000 }).toBe(2)
  await master.page.getByTestId('stop-all').click()
  const t0 = Date.now()
  await master.page.waitForTimeout(1000)
  const mid = await Promise.all([sound(master.page), sound(ana.page)])
  for (const s of mid) {
    expect(s.layers).toHaveLength(2)
    for (const l of s.layers) {
      expect(l.stopping).toBe(true)
      expect(l.gain).toBeGreaterThan(0.2) // halfway, not cut
      expect(l.gain).toBeLessThan(0.8)
    }
  }
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).layers, { timeout: 2500, intervals: [100] }).toEqual([])
  expect(Date.now() - t0).toBeLessThan(3200)
  await expect(master.page.getByTestId('playing-list')).toHaveText('Nenhuma música tocando')
})

test('[C16] SOM-16 an effect clicked plays once in every window, two clicks overlapping', async () => {
  const { master, ana, hash } = await table({ [SWORD]: toneWav(2.5) })
  await item(master.page, 'espada').click()
  await item(master.page, 'espada').click()
  // both strikes sound at the same time in each window: the second does not cut the first
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).effectsPlaying, { timeout: 2000, intervals: [50] }).toBe(2)
  for (const page of [master.page, ana.page]) {
    expect((await sound(page)).effects.filter((e) => e.hash === hash[SWORD]).map((e) => e.played)).toEqual([true, true])
    await expect.poll(async () => (await sound(page)).effectsPlaying, { timeout: 4000 }).toBe(0) // once each, no loop
  }
  expect((await sound(ana.page)).layers).toEqual([]) // an effect is not a layer
})

test('[C17] SOM-17 a player\'s window downloads the campaign\'s effects when it joins, before any is played', async () => {
  const { ana, hash } = await table({ [SWORD]: toneWav(1), 'efeitos/porta.wav': toneWav(1, 300) })
  for (const p of [SWORD, 'efeitos/porta.wav']) {
    await expect.poll(() => ana.page.evaluate((h) => window.mesa.cacheGet(h).then((b) => !!b), hash[p]), { timeout: 5000 }).toBe(true)
  }
  expect((await sound(ana.page)).effects).toEqual([])
})

test('[C19] SOM-19 a player\'s Sons has no control that plays or stops a sound, and a player\'s sound action is refused with "Sem permissão"', async () => {
  const { ana, hash } = await table({ [RAIN]: toneWav(2), [SWORD]: toneWav(1, 660) })
  const p = ana.page.getByTestId('panel-sons')
  await expect(p.getByTestId('sound-music')).toBeVisible() // only the personal controls
  for (const id of ['sound-item', 'stop-all', 'layer-volume', 'list-musicas', 'list-efeitos', 'add-musicas']) await expect(p.getByTestId(id), id).toHaveCount(0)
  const r = await ana.page.evaluate((h) => window.__mesaTest!.send({ type: 'sound/toggle', hash: h }), hash[RAIN])
  expect(r).toEqual({ ok: false, reason: 'Sem permissão' })
  const e = await ana.page.evaluate((h) => window.__mesaTest!.send({ type: 'sound/effect', hash: h }), hash[SWORD])
  expect(e).toEqual({ ok: false, reason: 'Sem permissão' })
  expect((await sound(ana.page)).layers).toEqual([])
})
