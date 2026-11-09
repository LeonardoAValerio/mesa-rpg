import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, masterAndPlayer, putAsset, snap, solidPng, type AppHandle } from './helpers'
import type { TokenSnapshot } from '../src/renderer/board/board'

test.afterEach(closeAll)

/** 800x600 map with 100 px cells; `tall` is a 512x768 PNG, `square` a 64x64 one. */
async function table(): Promise<{ master: AppHandle; player: AppHandle; tall: string; square: string }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const tall = await putAsset(master.app, solidPng(512, 768, [200, 180, 40]))
  const square = await putAsset(master.app, solidPng(64, 64, [90, 90, 200]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player, tall, square }
}
async function item(page: Page, name: string): Promise<TokenSnapshot> {
  await expect.poll(async () => (await snap(page)).tokens.find((t) => t.name === name)?.textured ?? false, { timeout: 10_000 }).toBe(true)
  return (await snap(page)).tokens.find((t) => t.name === name)!
}
const both = (m: AppHandle, p: AppHandle): Page[] => [m.page, p.page]

test('[C1] ITEM-01 a 512x768 PNG at 2 cells is drawn whole at 200x300, centred on its position, in every window', async () => {
  const { master, player, tall } = await table()
  await act(master.page, { type: 'token/place', hash: tall, name: 'Torre', kind: 'character', x: 400, y: 300, width: 2, ring: null })
  for (const page of both(master, player)) {
    const t = await item(page, 'Torre')
    expect([t.x, t.y]).toEqual([400, 300])
    expect(t.w).toBeCloseTo(200, 3)
    expect(t.h).toBeCloseTo(300, 3) // the PNG's 2:3 aspect, not a square
  }
  // a new size keeps the aspect
  const id = (await item(master.page, 'Torre')).id
  await act(master.page, { type: 'token/update', id, width: 1.5 })
  for (const page of both(master, player)) {
    await expect.poll(async () => Math.round((await item(page, 'Torre')).h)).toBe(225)
    expect((await item(page, 'Torre')).w).toBeCloseTo(150, 3)
  }
  // and the drawn rotation follows the item
  await act(master.page, { type: 'token/update', id, rotation: 90 })
  for (const page of both(master, player)) await expect.poll(async () => (await item(page, 'Torre')).rotation).toBe(90)
})

test('[C2] ITEM-02 only a character with a ring set gets a ring; no ring and no frame otherwise, objects included', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: 'inimigo' })
  await act(master.page, { type: 'token/place', hash: square, name: 'Elfa', kind: 'character', x: 350, y: 150, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: square, name: 'Baú', kind: 'object', x: 550, y: 150, width: 1, ring: 'npc' })
  for (const page of both(master, player)) {
    expect((await item(page, 'Goblin')).ring).toBe('#ef4444')
    expect((await item(page, 'Elfa')).ring).toBeNull()
    expect((await item(page, 'Baú')).ring).toBeNull()
  }
  await act(master.page, { type: 'token/update', id: (await item(master.page, 'Goblin')).id, ring: null })
  for (const page of both(master, player)) await expect.poll(async () => (await item(page, 'Goblin')).ring).toBeNull()
})

test('[C5] ITEM-05 a character shows its name under it; an object shows none', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: square, name: 'Baú', kind: 'object', x: 550, y: 150, width: 1, ring: null })
  for (const page of both(master, player)) {
    expect((await item(page, 'Goblin')).label).toBe('Goblin')
    expect((await item(page, 'Baú')).label).toBe('')
  }
})

test('[C7] ITEM-07 objects are drawn below characters, whatever the order they were placed in', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 300, y: 300, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: square, name: 'Tapete', kind: 'object', x: 300, y: 300, width: 2, ring: null }) // placed after, same spot
  for (const page of both(master, player)) {
    await item(page, 'Tapete')
    const s = await snap(page)
    const z = (n: string): number => s.tokens.find((t) => t.name === n)!.z
    expect(z('Tapete')).toBeLessThan(z('Goblin'))
  }
})

/** Drags the named item's centre to map point (x, y) with the real mouse, Shift held at the drop when asked. */
async function dragItem(page: Page, name: string, x: number, y: number, shift = false): Promise<void> {
  const t = await item(page, name)
  const s = await snap(page)
  const screen = (px: number, py: number) => ({ x: s.canvas.left + px * s.camera.scale + s.camera.x, y: s.canvas.top + py * s.camera.scale + s.camera.y })
  const a = screen(t.x, t.y)
  const b = screen(x, y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 6 })
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
}
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1.5

test('[C8] ITEM-08 a dropped character snaps its left and top edges to grid lines; a dropped object stays where it was dropped', async () => {
  const { master, player, square, tall } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: tall, name: 'Torre', kind: 'character', x: 650, y: 300, width: 1, ring: null }) // 100 x 150
  await act(master.page, { type: 'token/place', hash: square, name: 'Baú', kind: 'object', x: 150, y: 450, width: 0.5, ring: null })
  await dragItem(master.page, 'Goblin', 240, 260)
  await dragItem(master.page, 'Torre', 520, 330) // 100 x 150: edges at 470/255 snap to 500/300, centre (550, 375)
  await dragItem(master.page, 'Baú', 333, 377)
  for (const page of both(master, player)) {
    await expect.poll(async () => { const t = await item(page, 'Goblin'); return [t.x, t.y] }).toEqual([250, 250])
    await expect.poll(async () => { const t = await item(page, 'Torre'); return [t.x, t.y] }).toEqual([550, 375])
    await expect.poll(async () => { const t = await item(page, 'Baú'); return near(t.x, 333) && near(t.y, 377) }).toBe(true)
  }
})

test('[C9] ITEM-09 Shift held at the drop leaves a character free and snaps an object', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: square, name: 'Baú', kind: 'object', x: 150, y: 450, width: 1, ring: null })
  await dragItem(master.page, 'Goblin', 240, 260, true)
  await dragItem(master.page, 'Baú', 333, 377, true)
  for (const page of both(master, player)) {
    await expect.poll(async () => { const t = await item(page, 'Goblin'); return near(t.x, 240) && near(t.y, 260) }).toBe(true)
    await expect.poll(async () => { const t = await item(page, 'Baú'); return [t.x, t.y] }).toEqual([350, 350])
  }
})

test('a player moves a Livre item that is not theirs; nobody drags a Travado item (ITEM-14, ITEM-16)', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: null })
  await act(master.page, { type: 'token/place', hash: square, name: 'Baú', kind: 'object', x: 450, y: 450, width: 1, ring: null })
  await dragItem(player.page, 'Goblin', 340, 340)
  for (const page of both(master, player)) await expect.poll(async () => { const t = await item(page, 'Goblin'); return [t.x, t.y] }).toEqual([350, 350])
  await act(master.page, { type: 'token/update', id: (await item(master.page, 'Baú')).id, movement: 'locked' })
  for (const page of both(master, player)) {
    await expect.poll(async () => (await page.evaluate(() => window.__mesaTest!.board()!.dragging))).toBeNull()
    const t = await item(page, 'Baú')
    const s = await snap(page)
    await page.mouse.move(s.canvas.left + t.x * s.camera.scale + s.camera.x, s.canvas.top + t.y * s.camera.scale + s.camera.y)
    await page.mouse.down()
    expect(await page.evaluate(() => window.__mesaTest!.board()!.dragging), 'no drag starts').toBeNull()
    await page.mouse.move(10, 10, { steps: 3 })
    await page.mouse.up()
  }
  await master.page.waitForTimeout(300)
  for (const page of both(master, player)) expect([(await item(page, 'Baú')).x, (await item(page, 'Baú')).y]).toEqual([450, 450])
})

test('[C17] ITEM-17 a refused move puts the item back where it was', async () => {
  const { master, player, square } = await table()
  await act(master.page, { type: 'token/place', hash: square, name: 'Goblin', kind: 'character', x: 150, y: 150, width: 1, ring: null })
  const t = await item(player.page, 'Goblin')
  const s = await snap(player.page)
  const screen = (px: number, py: number) => ({ x: s.canvas.left + px * s.camera.scale + s.camera.x, y: s.canvas.top + py * s.camera.scale + s.camera.y })
  // the player is dragging when the master makes the Goblin "Só mestre"; the drop is refused
  await player.page.mouse.move(screen(t.x, t.y).x, screen(t.x, t.y).y)
  await player.page.mouse.down()
  await player.page.mouse.move(screen(440, 440).x, screen(440, 440).y, { steps: 6 })
  expect(await player.page.evaluate(() => window.__mesaTest!.board()!.dragging)).toBe(t.id)
  await act(master.page, { type: 'token/update', id: t.id, movement: 'master' })
  await player.page.waitForTimeout(300)
  await player.page.mouse.up()
  await expect.poll(async () => { const g = await item(player.page, 'Goblin'); return [g.x, g.y] }).toEqual([150, 150])
  expect([(await item(master.page, 'Goblin')).x, (await item(master.page, 'Goblin')).y]).toEqual([150, 150])
})
