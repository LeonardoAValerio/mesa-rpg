import { expect, test, type Page } from '@playwright/test'
import type { OverlaySnapshot } from '../src/renderer/board/overlays'
import { act, closeAll, masterAndPlayer, putAsset, screenOf, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

const overlays = (page: Page): Promise<OverlaySnapshot> => page.evaluate(() => window.__mesaTest!.overlays())

/** Ana (a player with no tokens) and the master on an 800x600 map with 100 px cells. */
async function table(): Promise<{ master: AppHandle; player: AppHandle }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await expect.poll(async () => (await snap(player.page)).map?.width).toBe(800)
  return { master, player }
}

test('[C59] TOOL-01 a ruler from (0,0) to (3,5) shows "5" in both windows while it is dragged', async () => {
  const { master, player } = await table()
  await player.page.getByTestId('tool-ruler').click()
  const a = await screenOf(player.page, 50, 50)
  const near = await screenOf(player.page, 250, 450)
  const b = await screenOf(player.page, 350, 550)
  await player.page.mouse.move(a.x, a.y)
  await player.page.mouse.down()
  await player.page.mouse.move(near.x, near.y, { steps: 10 })
  await player.page.mouse.move(b.x, b.y) // the last move comes right after the previous one; it must still reach the master
  await expect.poll(async () => (await overlays(player.page)).rulers).toEqual([{ from: 'Ana', distance: 5 }])
  await expect.poll(async () => (await overlays(master.page)).rulers).toEqual([{ from: 'Ana', distance: 5 }])
  await player.page.mouse.up()
})

test('[C60] TOOL-02 releasing the ruler clears it in both windows', async () => {
  const { master, player } = await table()
  await player.page.getByTestId('tool-ruler').click()
  const a = await screenOf(player.page, 50, 50)
  const b = await screenOf(player.page, 250, 50)
  await player.page.mouse.move(a.x, a.y)
  await player.page.mouse.down()
  await player.page.mouse.move(b.x, b.y, { steps: 5 })
  await expect.poll(async () => (await overlays(master.page)).rulers.length).toBe(1)
  await player.page.mouse.up()
  await expect.poll(async () => (await overlays(player.page)).rulers).toEqual([])
  await expect.poll(async () => (await overlays(master.page)).rulers).toEqual([])
})

test('[C61] TOOL-03 a ping shows in both windows and is gone 2 s later', async () => {
  const { master, player } = await table()
  await player.page.getByTestId('tool-ping').click()
  const p = await screenOf(player.page, 420, 310)
  await player.page.mouse.click(p.x, p.y)
  const t0 = Date.now()
  for (const page of [player.page, master.page]) {
    await expect.poll(async () => (await overlays(page)).pings.map((x) => x.from)).toEqual(['Ana'])
  }
  const ping = (await overlays(master.page)).pings[0]
  expect(ping.x).toBeCloseTo(420, 0)
  expect(ping.y).toBeCloseTo(310, 0)
  await master.page.waitForTimeout(Math.max(0, 1500 - (Date.now() - t0)))
  expect((await overlays(master.page)).pings).toHaveLength(1) // still there at 1.5 s
  await expect.poll(async () => (await overlays(master.page)).pings, { timeout: 1500 }).toEqual([])
  await expect.poll(async () => (await overlays(player.page)).pings, { timeout: 1000 }).toEqual([])
  expect(Date.now() - t0).toBeLessThan(3200)
})

test('[C62] TOOL-04 a stroke shows in both windows and is gone 5 s after the mouse is released', async () => {
  const { master, player } = await table()
  await player.page.getByTestId('tool-draw').click()
  const a = await screenOf(player.page, 100, 100)
  const b = await screenOf(player.page, 500, 400)
  await player.page.mouse.move(a.x, a.y)
  await player.page.mouse.down()
  await player.page.mouse.move(b.x, b.y, { steps: 20 })
  await player.page.mouse.up()
  const t0 = Date.now()
  for (const page of [player.page, master.page]) {
    await expect.poll(async () => (await overlays(page)).strokes.map((s) => ({ from: s.from, done: s.done }))).toEqual([{ from: 'Ana', done: true }])
  }
  expect((await overlays(master.page)).strokes[0].points).toBeGreaterThan(5)
  await master.page.waitForTimeout(Math.max(0, 4300 - (Date.now() - t0)))
  expect((await overlays(master.page)).strokes).toHaveLength(1) // still there at 4.3 s
  expect((await overlays(player.page)).strokes).toHaveLength(1)
  await expect.poll(async () => (await overlays(player.page)).strokes, { timeout: 2000 }).toEqual([])
  await expect.poll(async () => (await overlays(master.page)).strokes, { timeout: 1000 }).toEqual([])
  expect(Date.now() - t0).toBeLessThan(6500)
})

test('the ruler tool does not move tokens (TOOL-01)', async () => {
  const { master } = await table()
  const tok = await putAsset(master.app, solidPng(16, 16))
  await act(master.page, { type: 'token/place', hash: tok, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: 'inimigo' })
  await master.page.getByTestId('tool-ruler').click()
  const a = await screenOf(master.page, 150, 150)
  await master.page.mouse.move(a.x, a.y)
  await master.page.mouse.down()
  await master.page.mouse.move(a.x + 200, a.y, { steps: 5 })
  await master.page.mouse.up()
  expect((await snap(master.page)).tokens[0]).toMatchObject({ x: 150, y: 150 })
})
