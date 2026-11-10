import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, fogSample, masterAndPlayer, putAsset, screenOf, solidPng, type AppHandle, pickTool, openFog } from './helpers'

test.afterEach(closeAll)

/** 800x600 map with 100 px cells and no fog; the master has picked `tool`. */
async function table(tool?: string): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  if (tool) await pickTool(master.page, tool.replace('tool-', ''))
  return { master, player }
}
const fogTool = (page: Page) => page.evaluate(() => window.__mesaTest!.fogTool())
async function to(page: Page, x: number, y: number): Promise<void> {
  const p = await screenOf(page, x, y)
  await page.mouse.move(p.x, p.y, { steps: 4 })
}
/** Presses at (x0, y0), moves through `path` and stops before releasing. */
async function press(page: Page, x0: number, y0: number, ...path: Array<[number, number]>): Promise<void> {
  await to(page, x0, y0)
  await page.mouse.down()
  for (const [x, y] of path) await to(page, x, y)
}
const both = (m: AppHandle, p: AppHandle): Page[] => [m.page, p.page]

test('[C1] FOGS-01 a brush drag covers the points within the brush radius of the path, and none past it, in every window', async () => {
  const { master, player } = await table('tool-fog-brush') // radius 1 cell = 100 px, mode Cobrir
  await press(master.page, 150, 300, [300, 300], [450, 300], [650, 300])
  await master.page.mouse.up()
  const inside: Array<[number, number]> = [[400, 300], [400, 390], [400, 210], [60, 300], [740, 300], [650, 395]]
  const outside: Array<[number, number]> = [[400, 420], [400, 180], [30, 300], [770, 300], [100, 100], [700, 500]]
  for (const page of both(master, player)) {
    await expect.poll(() => fogSample(page, inside)).toEqual(inside.map(() => true))
    expect(await fogSample(page, outside)).toEqual(outside.map(() => false))
  }
})

test('[C2] FOGS-02 a rectangle covers exactly its inside in every window', async () => {
  const { master, player } = await table('tool-fog-rect')
  await press(master.page, 200, 150, [500, 350])
  await master.page.mouse.up()
  const inside: Array<[number, number]> = [[205, 155], [495, 345], [350, 250]]
  const outside: Array<[number, number]> = [[190, 250], [510, 250], [350, 140], [350, 360]]
  for (const page of both(master, player)) {
    await expect.poll(() => fogSample(page, inside)).toEqual(inside.map(() => true))
    expect(await fogSample(page, outside)).toEqual(outside.map(() => false))
  }
})

test('[C11] FOGT-02 holding Alt draws in the opposite mode, and releasing it goes back to the selected mode', async () => {
  const { master, player } = await table('tool-fog-rect')
  await master.page.getByTestId('fog-cover-all').click()
  await master.page.keyboard.down('Alt')
  await press(master.page, 100, 100, [300, 300])
  await master.page.mouse.up()
  await master.page.keyboard.up('Alt')
  await expect.poll(() => fogSample(player.page, [[200, 200], [400, 400]])).toEqual([false, true]) // revealed with Cobrir selected
  await press(master.page, 150, 150, [250, 250])
  await master.page.mouse.up()
  await expect.poll(() => fogSample(player.page, [[200, 200], [120, 120]])).toEqual([true, false]) // no Alt: Cobrir again
  // and the other way round
  await openFog(master.page)
  await master.page.getByTestId('fog-mode-reveal').click()
  await master.page.keyboard.down('Alt')
  await press(master.page, 500, 100, [700, 300])
  await master.page.mouse.up()
  await master.page.keyboard.up('Alt')
  await expect.poll(() => fogSample(player.page, [[600, 200]])).toEqual([true])
})

test('[C12] FOGT-03 the brush shows a circle of its radius under the cursor', async () => {
  const { master } = await table('tool-fog-brush')
  await to(master.page, 400, 300)
  // measured from the circle that is drawn: centre on the cursor, radius 1 cell = 100 px
  await expect.poll(async () => (await fogTool(master.page))!.cursor).not.toBeNull()
  const c = (await fogTool(master.page))!.cursor!
  expect(Math.abs(c.x - 400)).toBeLessThan(2)
  expect(Math.abs(c.y - 300)).toBeLessThan(2)
  expect(Math.abs(c.r - 100)).toBeLessThan(2)
  await openFog(master.page)
  await master.page.getByTestId('fog-radius').fill('2.5')
  await master.page.getByTestId('fog-radius').press('Enter')
  await to(master.page, 200, 200)
  await expect.poll(async () => Math.round((await fogTool(master.page))!.cursor!.r)).toBe(250)
  // the input clamps what the master types (FOGT-06)
  await openFog(master.page)
  await master.page.getByTestId('fog-radius').fill('13')
  await master.page.getByTestId('fog-radius').press('Enter')
  await expect(master.page.getByTestId('fog-radius')).toHaveValue('10')
  // no circle with the rectangle
  await pickTool(master.page, 'fog-rect')
  await to(master.page, 300, 300)
  expect((await fogTool(master.page))!.cursor).toBeNull()
})

test('[C13] FOGT-04 while drawing only the master sees a preview; the fog changes in every window on release', async () => {
  const { master, player } = await table('tool-fog-brush')
  await press(master.page, 150, 300, [400, 300], [600, 300])
  await expect.poll(async () => (await fogTool(master.page))!.preview).toMatchObject({ kind: 'stroke', mode: 'cover' })
  // the drawn preview spans the path plus the brush radius on each side: x 50..700, y 200..400
  const box = (await fogTool(master.page))!.preview!
  expect(Math.abs(box.x - 50)).toBeLessThan(5)
  expect(Math.abs(box.x + box.w - 700)).toBeLessThan(5)
  expect(Math.abs(box.y - 200)).toBeLessThan(5)
  expect(Math.abs(box.h - 200)).toBeLessThan(5)
  await master.page.waitForTimeout(400)
  for (const page of both(master, player)) expect(await fogSample(page, [[400, 300]]), 'nothing sent yet').toEqual([false])
  await master.page.mouse.up()
  expect((await fogTool(master.page))!.preview).toBeNull()
  for (const page of both(master, player)) await expect.poll(() => fogSample(page, [[400, 300]])).toEqual([true])
  // the rectangle the same
  await pickTool(master.page, 'fog-rect')
  await press(master.page, 100, 450, [300, 550])
  await expect.poll(async () => (await fogTool(master.page))!.preview).toMatchObject({ kind: 'rect' })
  const r = (await fogTool(master.page))!.preview!
  expect([Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h)]).toEqual([100, 450, 200, 100])
  await master.page.waitForTimeout(400)
  expect(await fogSample(player.page, [[200, 500]])).toEqual([false])
  await master.page.mouse.up()
  await expect.poll(() => fogSample(player.page, [[200, 500]])).toEqual([true])
})

/** An L-shaped polygon: the notch at (400, 400) is outside it. */
const L: Array<[number, number]> = [[100, 100], [500, 100], [500, 200], [250, 200], [250, 500], [100, 500]]
const L_IN: Array<[number, number]> = [[150, 450], [450, 150], [180, 180]]
const L_OUT: Array<[number, number]> = [[400, 400], [550, 150], [180, 550], [50, 300]]
async function clickAt(page: Page, x: number, y: number, clickCount = 1): Promise<void> {
  const p = await screenOf(page, x, y)
  await page.mouse.click(p.x, p.y, { clickCount })
}

test('[C3] FOGS-03 a polygon closed on its first point, by a double click or by Enter covers its inside only, in every window', async () => {
  const { master, player } = await table('tool-fog-poly')
  const closings: Array<[string, (page: Page) => Promise<void>]> = [
    ['first point', async (page) => {
      for (const [x, y] of L) await clickAt(page, x, y)
      await clickAt(page, L[0][0] + 2, L[0][1] + 2) // a few pixels off still closes
    }],
    ['double click', async (page) => {
      for (const [x, y] of L.slice(0, -1)) await clickAt(page, x, y)
      await clickAt(page, L[5][0], L[5][1], 2)
    }],
    ['Enter', async (page) => {
      for (const [x, y] of L) await clickAt(page, x, y)
      await page.keyboard.press('Enter')
    }]
  ]
  for (const [how, close] of closings) {
    await master.page.getByTestId('fog-reveal-all').click()
    await expect.poll(() => fogSample(player.page, L_IN)).toEqual(L_IN.map(() => false))
    await close(master.page)
    for (const page of both(master, player)) {
      await expect.poll(() => fogSample(page, L_IN), how).toEqual(L_IN.map(() => true))
      expect(await fogSample(page, L_OUT), how).toEqual(L_OUT.map(() => false))
    }
    expect((await fogTool(master.page))!.preview, how).toBeNull()
  }
})

test('[C14] FOGT-05 Esc while drawing a polygon discards it and sends nothing', async () => {
  const { master, player } = await table('tool-fog-poly')
  for (const [x, y] of L.slice(0, 4)) await clickAt(master.page, x, y)
  await expect.poll(async () => (await fogTool(master.page))!.preview).toMatchObject({ kind: 'poly', points: 4 })
  await master.page.keyboard.press('Escape')
  expect((await fogTool(master.page))!.preview).toBeNull()
  // more clicks start a new polygon, and Enter with two points sends nothing either
  await clickAt(master.page, 600, 400)
  await clickAt(master.page, 700, 450)
  await master.page.keyboard.press('Enter')
  await master.page.waitForTimeout(400)
  for (const page of both(master, player)) {
    expect(await fogSample(page, [...L_IN, [650, 420]])).toEqual([false, false, false, false])
    expect((await page.evaluate(() => window.__mesaTest!.board()!.fog)).shapes).toBe(0)
  }
})

test('the master sees "Névoa com formas demais: use Cobrir tudo ou Revelar tudo" past 2000 shapes, and "Cobrir tudo" clears it (FOGS-08)', async () => {
  const { master, player } = await table('tool-fog-rect')
  await master.page.evaluate(async () => {
    for (let i = 0; i < 2000; i++) await window.__mesaTest!.send({ type: 'fog/shape', shape: { kind: 'rect', mode: 'cover', x: i % 800, y: 0, w: 1, h: 1 } })
  })
  await expect(master.page.getByTestId('fog-error')).toHaveText('')
  await press(master.page, 200, 200, [400, 400])
  await master.page.mouse.up()
  await expect(master.page.getByTestId('fog-error')).toHaveText('Névoa com formas demais: use Cobrir tudo ou Revelar tudo')
  expect(await fogSample(player.page, [[300, 300]])).toEqual([false])
  await master.page.getByTestId('fog-cover-all').click()
  await expect(master.page.getByTestId('fog-error')).toHaveText('')
  await expect.poll(() => fogSample(player.page, [[300, 300]])).toEqual([true])
})

test('a self-crossing polygon is drawn as the fog rule decides: a covering star leaves its centre revealed, with a token there visible (FOGS-03, FOGS-06)', async () => {
  const { master, player } = await table('tool-fog-poly')
  const tok = await putAsset(master.app, solidPng(16, 16))
  await act(master.page, { type: 'token/place', hash: tok, name: 'Goblin', kind: 'character', x: 350, y: 250, width: 1, ring: 'inimigo' }) // centre (350, 250)
  const star: Array<[number, number]> = [[350, 50], [470, 420], [160, 190], [540, 190], [230, 420]]
  for (const [x, y] of star) await clickAt(master.page, x, y)
  await master.page.keyboard.press('Enter')
  const tips: Array<[number, number]> = [[350, 100], [200, 192], [500, 192]]
  for (const page of both(master, player)) {
    await expect.poll(() => fogSample(page, tips)).toEqual(tips.map(() => true))
    expect(await fogSample(page, [[350, 250]]), 'the centre is revealed on screen').toEqual([false])
  }
  // the model agrees: the Goblin in the centre reaches the player
  await expect.poll(async () => (await player.page.evaluate(() => window.__mesaTest!.board()!.tokens.map((t) => t.name)))).toEqual(['Goblin'])
})

test('on a 4096x3072 map the drawn fog sits where the shapes are, in every window (texture scaled to 2048 px)', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(4096, 3072, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 4096, height: 3072, grid: { cell: 128, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/shape', shape: { kind: 'rect', mode: 'cover', x: 3000, y: 2000, w: 500, h: 400 } })
  const inside: Array<[number, number]> = [[3010, 2010], [3490, 2390], [3250, 2200]]
  const outside: Array<[number, number]> = [[2980, 2200], [3520, 2200], [3250, 1980], [3250, 2420], [1500, 1000]]
  for (const page of [master.page, player.page]) {
    await expect.poll(() => fogSample(page, inside)).toEqual(inside.map(() => true))
    expect(await fogSample(page, outside)).toEqual(outside.map(() => false))
  }
})
