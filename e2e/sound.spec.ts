import { expect, test, type Page } from '@playwright/test'
import { closeAll, freePort, host, join, launch, putFile, showPanel, type AppHandle } from './helpers'
import { toneWav } from './fixtures'

test.afterEach(closeAll)

type Snap = ReturnType<NonNullable<Window['__mesaTest']>['sound']>
/** What plays in a window, read from its audio nodes; waits for the table's test hook after a join. */
async function sound(page: Page): Promise<Snap> {
  await page.waitForFunction(() => !!window.__mesaTest)
  return page.evaluate(() => window.__mesaTest!.sound())
}
const send = (page: Page, action: unknown) => page.evaluate((a) => window.__mesaTest!.send(a as never), action)

/** The master on a free port with `musicas/chuva.wav` (30 s) in the campaign; returns its hash. */
async function masterWithMusic(): Promise<{ master: AppHandle; port: number; rain: string }> {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  putFile(master, 'musicas/chuva.wav', toneWav(30))
  let rain = ''
  await expect.poll(async () => {
    const info = await master.page.evaluate(() => window.mesa.campaign())
    rain = info?.sounds.find((s) => s.path === 'musicas/chuva.wav')?.hash ?? ''
    return rain
  }, { timeout: 5000 }).not.toBe('')
  return { master, port, rain }
}
async function player(port: number, name = 'Ana', userData?: string): Promise<AppHandle> {
  const p = await launch(userData ? { userData } : {})
  await join(p.page, port, name)
  return p
}
const layerOf = async (page: Page, hash: string) => (await sound(page)).layers.find((l) => l.hash === hash)

test('[C12] SOM-12 someone joining while a layer plays hears it from the master\'s point, at full volume with no rise', async () => {
  const { master, port, rain } = await masterWithMusic()
  expect(await send(master.page, { type: 'sound/toggle', hash: rain })).toEqual({ ok: true })
  await master.page.waitForTimeout(3500) // past the 2-second rise, 3.5 s into the loop
  const ana = await player(port)
  await expect.poll(async () => (await layerOf(ana.page, rain))?.playing, { timeout: 10_000 }).toBe(true)
  const first = (await layerOf(ana.page, rain))!
  expect(first.gain).toBeGreaterThan(0.99) // no rise from 0
  const [m, a] = await Promise.all([layerOf(master.page, rain), layerOf(ana.page, rain)])
  expect(m!.position).toBeGreaterThan(3)
  expect(Math.abs(m!.position - a!.position)).toBeLessThanOrEqual(1)
})

test('[C13] SOM-13 two windows play a layer at most 1 s apart, even when the player\'s computer clock is 7 s off', async () => {
  const { master, port, rain } = await masterWithMusic()
  const ana = await launch()
  // another computer: its clock runs 7 s ahead of the master's
  await ana.page.evaluate(() => {
    const real = Date.now.bind(Date)
    Date.now = () => real() + 7000
  })
  await join(ana.page, port, 'Ana')
  await send(master.page, { type: 'sound/toggle', hash: rain })
  await expect.poll(async () => (await layerOf(ana.page, rain))?.playing, { timeout: 10_000 }).toBe(true)
  for (let i = 0; i < 4; i++) {
    const [m, a] = await Promise.all([layerOf(master.page, rain), layerOf(ana.page, rain)])
    expect(m!.playing && a!.playing).toBe(true)
    expect(Math.abs(m!.position - a!.position), `sample ${i}`).toBeLessThanOrEqual(1)
    await master.page.waitForTimeout(1000)
  }
})

test('[C15] SOM-15 a window stops every sound when the master ends the table, and when its connection is lost', async () => {
  // the master ends the table
  {
    const { master, port, rain } = await masterWithMusic()
    const ana = await player(port)
    await send(master.page, { type: 'sound/toggle', hash: rain })
    await expect.poll(async () => (await layerOf(ana.page, rain))?.playing, { timeout: 10_000 }).toBe(true)
    await master.page.getByTestId('stop-host').click()
    await expect.poll(async () => (await sound(ana.page)).layers, { timeout: 5000 }).toEqual([])
  }
  // the connection drops with no goodbye: the master's app dies
  {
    const { master, port, rain } = await masterWithMusic()
    const ana = await player(port, 'Bia')
    await send(master.page, { type: 'sound/toggle', hash: rain })
    await expect.poll(async () => (await layerOf(ana.page, rain))?.playing, { timeout: 10_000 }).toBe(true)
    master.app.process().kill('SIGKILL')
    await expect.poll(async () => (await sound(ana.page)).layers, { timeout: 5000 }).toEqual([])
    expect((await sound(ana.page)).musicLevel).toBeLessThan(0.001)
  }
})

test('[C20] SOM-20 every window has "Música" and "Efeitos" from 0 to 100 at 80 and "Mudo" off', async () => {
  const { master, port } = await masterWithMusic()
  const ana = await player(port)
  for (const page of [master.page, ana.page]) {
    await showPanel(page, 'sons')
    const p = page.getByTestId('panel-sons')
    for (const id of ['sound-music', 'sound-effects']) {
      await expect(p.getByTestId(id)).toHaveValue('80')
      await expect(p.getByTestId(id)).toHaveAttribute('min', '0')
      await expect(p.getByTestId(id)).toHaveAttribute('max', '100')
    }
    await expect(p.getByTestId('sound-mute')).not.toBeChecked()
    const snap = await sound(page)
    expect(snap.musicBus).toBeCloseTo(0.8)
    expect(snap.effectsBus).toBeCloseTo(0.8)
  }
})

test('[C21] SOM-21 "Música" scales every layer in that window only, in what it really plays', async () => {
  const { master, port, rain } = await masterWithMusic()
  const ana = await player(port)
  await send(master.page, { type: 'sound/toggle', hash: rain })
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await layerOf(page, rain))?.gain, { timeout: 10_000 }).toBeGreaterThan(0.99)
  const before = await Promise.all([sound(master.page), sound(ana.page)])
  expect(before[0].musicLevel).toBeGreaterThan(0.01) // the tone is heard
  expect(before[1].musicLevel / before[0].musicLevel).toBeCloseTo(1, 1)
  await showPanel(ana.page, 'sons')
  await ana.page.getByTestId('sound-music').fill('20')
  // Ana plays at 20 / 80 of the master's level; the master is unchanged
  await expect.poll(async () => {
    const [m, a] = await Promise.all([sound(master.page), sound(ana.page)])
    return a.musicLevel / m.musicLevel
  }).toBeCloseTo(0.25, 1)
  expect((await sound(master.page)).musicLevel).toBeCloseTo(before[0].musicLevel, 2)
})

test('[C22] SOM-22 "Efeitos" scales effects in that window only, in what it really plays', async () => {
  const { master, port } = await masterWithMusic()
  putFile(master, 'efeitos/vento.wav', toneWav(4, 330))
  let wind = ''
  await expect.poll(async () => (wind = (await master.page.evaluate(() => window.mesa.campaign()))?.sounds.find((s) => s.path === 'efeitos/vento.wav')?.hash ?? '')).not.toBe('')
  const ana = await player(port)
  await showPanel(ana.page, 'sons')
  await ana.page.getByTestId('sound-effects').fill('50')
  await expect.poll(async () => (await sound(ana.page)).effectsBus).toBeCloseTo(0.5)
  await send(master.page, { type: 'sound/effect', hash: wind })
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await sound(page)).effectsLevel, { timeout: 3000 }).toBeGreaterThan(0.01)
  const [m, a] = await Promise.all([sound(master.page), sound(ana.page)])
  expect(a.effectsLevel / m.effectsLevel).toBeCloseTo(0.625, 1) // 50 / 80
  expect(a.musicLevel).toBeLessThan(0.001) // no music playing: only effects moved
})

test('[C23] SOM-23 "Mudo" silences what the window plays and turning it off brings the volumes back', async () => {
  const { master, port, rain } = await masterWithMusic()
  const ana = await player(port)
  await send(master.page, { type: 'sound/toggle', hash: rain })
  for (const page of [master.page, ana.page]) await expect.poll(async () => (await layerOf(page, rain))?.gain, { timeout: 10_000 }).toBeGreaterThan(0.99)
  await showPanel(ana.page, 'sons')
  await ana.page.getByTestId('sound-music').fill('30')
  await ana.page.getByTestId('sound-effects').fill('60')
  await ana.page.getByTestId('sound-mute').check()
  await expect.poll(async () => (await sound(ana.page)).musicLevel).toBeLessThan(0.0005)
  expect([(await sound(ana.page)).musicBus, (await sound(ana.page)).effectsBus]).toEqual([0, 0])
  expect((await sound(master.page)).musicLevel).toBeGreaterThan(0.01) // the master still hears it
  await ana.page.getByTestId('sound-mute').uncheck()
  await expect.poll(async () => {
    const [m, a] = await Promise.all([sound(master.page), sound(ana.page)])
    return a.musicLevel / m.musicLevel
  }).toBeCloseTo(0.375, 1) // 30 / 80
  expect((await sound(ana.page)).effectsBus).toBeCloseTo(0.6)
})

test('[C24] SOM-24 "Música", "Efeitos" and "Mudo" come back when the app opens again on the same computer', async () => {
  const { port } = await masterWithMusic()
  const ana = await player(port)
  await showPanel(ana.page, 'sons')
  await ana.page.getByTestId('sound-music').fill('20')
  await ana.page.getByTestId('sound-effects').fill('45')
  await ana.page.getByTestId('sound-mute').check()
  await ana.app.close()
  const again = await player(port, 'Ana', ana.userData)
  await showPanel(again.page, 'sons')
  await expect(again.page.getByTestId('sound-music')).toHaveValue('20')
  await expect(again.page.getByTestId('sound-effects')).toHaveValue('45')
  await expect(again.page.getByTestId('sound-mute')).toBeChecked()
  expect(await sound(again.page)).toMatchObject({ music: 20, effectsVolume: 45, muted: true, musicBus: 0, effectsBus: 0 }) // 0 is exact in float32
})

test('[C5] SOM-05 Sons is in every starting layout and in "Painéis"; a layout saved by 0.7.0 gives the starting one', async () => {
  const { master, port } = await masterWithMusic()
  const ana = await player(port)
  for (const page of [master.page, ana.page]) {
    await expect(page.getByTestId('tab-sons')).toHaveText(/^Sons/)
    await page.getByTestId('panels-button').click()
    await expect(page.getByTestId('panels-menu-sons')).toBeVisible()
    await page.getByTestId('panels-button').click()
  }
  // a 0.7.0 layout: no Sons, under the old key
  await master.page.getByTestId('close-sons').click()
  await expect.poll(() => master.page.evaluate(() => localStorage.getItem('mesa-layout-v3-master') ?? '')).not.toContain('"sons"')
  await master.page.getByTestId('stop-host').click()
  await master.page.evaluate(() => {
    localStorage.setItem('mesa-layout-v2-master', localStorage.getItem('mesa-layout-v3-master')!)
    localStorage.removeItem('mesa-layout-v3-master')
  })
  await host(master.page, await freePort())
  await expect.poll(async () => (await master.page.evaluate(() => window.__mesaTest!.layout())).groups.map((g) => g.panels)).toEqual([['mesa'], ['conectados', 'rede'], ['tokens', 'mapas', 'dados', 'chat', 'sons']])
})
