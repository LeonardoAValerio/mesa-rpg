import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join as pathJoin } from 'node:path'
import type { TokenSnapshot } from '../src/renderer/board/board'
import { act, campaignDir, closeAll, masterAndPlayer, nextOpenDialog, putAsset, putFile, showPanel, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

/** Master and Ana on an 800x600 map with 100 px cells. */
async function table(): Promise<{ master: AppHandle; player: AppHandle; square: string; map: string }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const square = await putAsset(master.app, solidPng(64, 64, [90, 90, 200]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  return { master, player, square, map }
}
async function item(page: Page, name: string): Promise<TokenSnapshot> {
  await expect.poll(async () => (await snap(page)).tokens.find((t) => t.name === name)?.textured ?? false, { timeout: 10_000 }).toBe(true)
  return (await snap(page)).tokens.find((t) => t.name === name)!
}
const at = async (page: Page, x: number, y: number): Promise<{ x: number; y: number }> => {
  const s = await snap(page)
  return { x: s.canvas.left + x * s.camera.scale + s.camera.x, y: s.canvas.top + y * s.camera.scale + s.camera.y }
}
/** Grabs an item at its centre and lets it go with its centre at (x, y) on the map. */
async function dragItem(page: Page, name: string, x: number, y: number, shift = false): Promise<void> {
  const t = await item(page, name)
  const a = await at(page, t.x, t.y)
  const b = await at(page, x, y)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 6 })
  if (shift) await page.keyboard.down('Shift')
  await page.mouse.up()
  if (shift) await page.keyboard.up('Shift')
}
const centre = async (page: Page, name: string): Promise<number[]> => {
  const t = await item(page, name)
  return [Math.round(t.x * 10) / 10, Math.round(t.y * 10) / 10]
}
const place = (page: Page, hash: string, name: string, width: number, x = 450, y = 450) =>
  act(page, { type: 'token/place', hash, name, kind: 'character', x, y, width, ring: null })
async function setGridVisible(page: Page, on: boolean): Promise<void> {
  await showPanel(page, 'mapas')
  const box = page.getByTestId('grid-visible')
  if (on) await box.check()
  else await box.uncheck()
}
async function saveScene(page: Page, name: string): Promise<void> {
  await showPanel(page, 'mapas')
  await page.getByTestId('save-scene').click()
  await page.getByTestId('scene-name').fill(name)
  await page.getByTestId('scene-name-ok').click()
  await expect(page.getByTestId('scene-item').filter({ hasText: name })).toBeVisible({ timeout: 5000 })
}
const lines = async (page: Page): Promise<number> => (await snap(page)).grid?.lines ?? -1

test('[C1] BRD-01 a dropped character lands centred: on a cell centre for 1, 1.5 and 3 cells, on the lines for 2 cells', async () => {
  const { master, player, square } = await table()
  await place(master.page, square, 'Um', 1, 150, 150)
  await place(master.page, square, 'Meio', 1.5, 450, 150)
  await place(master.page, square, 'Dois', 2, 650, 450)
  await place(master.page, square, 'Tres', 3, 250, 450)
  await dragItem(master.page, 'Um', 330, 170)
  await dragItem(master.page, 'Meio', 530, 170)
  await dragItem(master.page, 'Dois', 630, 370)
  await dragItem(master.page, 'Tres', 230, 380)
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'Um')).toEqual([350, 150])
    await expect.poll(() => centre(page, 'Meio')).toEqual([550, 150]) // not 575/175 (edges on lines)
    await expect.poll(() => centre(page, 'Dois')).toEqual([600, 400]) // on a crossing: fills 4 cells
    await expect.poll(() => centre(page, 'Tres')).toEqual([250, 350])
  }
})

test('[C2] BRD-02 a character dragged from the campaign list lands centred by the same rule', async () => {
  const { master, player } = await table()
  putFile(master, 'tokens/ogro.png', solidPng(64, 64, [200, 30, 30]))
  putFile(master, 'tokens/ogro.json', JSON.stringify({ tamanho: 1.5 }))
  putFile(master, 'tokens/gigante.png', solidPng(64, 64, [30, 30, 200]))
  putFile(master, 'tokens/gigante.json', JSON.stringify({ tamanho: 2 }))
  await showPanel(master.page, 'tokens')
  await expect(master.page.getByTestId('library-item')).toHaveCount(2, { timeout: 5000 })
  const canvas = master.page.getByTestId('board-canvas')
  const s = await snap(master.page)
  const to = (x: number, y: number) => ({ x: x * s.camera.scale + s.camera.x, y: y * s.camera.scale + s.camera.y })
  await master.page.getByTestId('library-item').filter({ hasText: 'ogro' }).dragTo(canvas, { targetPosition: to(130, 170) })
  await master.page.getByTestId('library-item').filter({ hasText: 'gigante' }).dragTo(canvas, { targetPosition: to(430, 370) })
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'ogro')).toEqual([150, 150])
    await expect.poll(() => centre(page, 'gigante')).toEqual([400, 400])
  }
})

test('[C3] BRD-03 "Mostrar grid" off hides the lines in every window, and on draws them again', async () => {
  const { master, player } = await table()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(10)
  await setGridVisible(master.page, false)
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
  await expect(master.page.getByTestId('grid-visible')).not.toBeChecked()
  await setGridVisible(master.page, true)
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(16) // 9 + 7 lines on 800 x 600
})

test('[C4] BRD-04 with the grid hidden a dropped character stays where dropped; Shift snaps it to the hidden grid', async () => {
  const { master, player, square } = await table()
  await place(master.page, square, 'Livre', 1, 150, 150)
  await place(master.page, square, 'Preso', 1, 450, 150)
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(master.page)).toBe(0)
  await dragItem(master.page, 'Livre', 333, 377)
  await dragItem(master.page, 'Preso', 533, 377, true)
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await centre(page, 'Livre')).map((v, i) => Math.abs(v - [333, 377][i]) < 1.5)).toEqual([true, true])
    await expect.poll(() => centre(page, 'Preso')).toEqual([550, 350])
  }
})

test('[C5] BRD-05 a scene saved with the grid hidden loads hidden, as .cena and as .mesa', async () => {
  const { master, player } = await table()
  await setGridVisible(master.page, false)
  await saveScene(master.page, 'Cidade')
  await setGridVisible(master.page, true)
  await expect.poll(() => lines(player.page)).toBeGreaterThan(0)
  await master.page.getByTestId('scene-item').filter({ hasText: 'Cidade' }).click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
  await expect(master.page.getByTestId('grid-visible')).not.toBeChecked()
  // the full file
  const out = pathJoin(campaignDir(master), '..', 'cidade.mesa')
  await master.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, out)
  await master.page.getByTestId('export-mesa').click()
  await expect.poll(() => { try { return JSON.parse(readFileSync(out, 'utf8')).scene.grid.visible } catch { return null } }).toBe(false)
  await setGridVisible(master.page, true)
  await expect.poll(() => lines(player.page)).toBeGreaterThan(0)
  await nextOpenDialog(master.app, [out])
  await master.page.getByTestId('import-mesa').click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBe(0)
})

test('[C6] BRD-06 a scene saved before this feature, and a new map, show the grid', async () => {
  const { master, player, map } = await table()
  await saveScene(master.page, 'Antiga')
  const file = pathJoin(campaignDir(master), 'cenas', 'Antiga.cena')
  const old = JSON.parse(readFileSync(file, 'utf8'))
  delete old.scene.grid.visible // as 0.8.0 wrote it
  writeFileSync(file, JSON.stringify(old))
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(player.page)).toBe(0)
  await master.page.getByTestId('scene-item').filter({ hasText: 'Antiga' }).click()
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(0)
  // a new map shows the grid even when it was hidden
  await setGridVisible(master.page, false)
  await expect.poll(() => lines(player.page)).toBe(0)
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  for (const page of [master.page, player.page]) await expect.poll(() => lines(page)).toBeGreaterThan(0)
  await expect(master.page.getByTestId('grid-visible')).toBeChecked()
})

test('[C7] BRD-07 a player\'s change of the grid visibility is refused with "Sem permissão"', async () => {
  const { master, player } = await table()
  const r = await player.page.evaluate(() => window.__mesaTest!.send({ type: 'grid/set', grid: { visible: false } }))
  expect(r).toEqual({ ok: false, reason: 'Sem permissão' })
  for (const page of [master.page, player.page]) expect(await lines(page)).toBeGreaterThan(0)
  await expect(player.page.getByTestId('grid-visible')).toHaveCount(0) // no switch for a player
})

const ids = async (page: Page): Promise<string[]> => [...(await snap(page)).selection.ids].sort()
const idOf = async (page: Page, name: string): Promise<string> => (await item(page, name)).id
const idsOf = async (page: Page, ...names: string[]): Promise<string[]> => (await Promise.all(names.map((n) => idOf(page, n)))).sort()
/** Drags a selection box on the map from (x0, y0) to (x1, y1), map pixels. */
async function boxDrag(page: Page, x0: number, y0: number, x1: number, y1: number): Promise<void> {
  const a = await at(page, x0, y0)
  const b = await at(page, x1, y1)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down()
  await page.mouse.move(b.x, b.y, { steps: 8 })
  await page.mouse.up()
}
async function clickItem(page: Page, name: string, modifiers: Array<'Shift'> = []): Promise<void> {
  const t = await item(page, name)
  const p = await at(page, t.x, t.y)
  for (const m of modifiers) await page.keyboard.down(m)
  await page.mouse.click(p.x, p.y)
  for (const m of modifiers) await page.keyboard.up(m)
}
/** Goblins at (150,150), (250,150), (150,250), a locked door at (250,250), Ana's Guerreira at (450,150), a "Só mestre" chest at (550,150), a hidden spy at (450,250). */
async function crowd(): Promise<{ master: AppHandle; player: AppHandle }> {
  const t = await table()
  const m = t.master.page
  for (const [name, x, y] of [['G1', 150, 150], ['G2', 250, 150], ['G3', 150, 250]] as const) await place(m, t.square, name, 1, x, y)
  await act(m, { type: 'token/place', hash: t.square, name: 'Porta', kind: 'object', x: 250, y: 250, width: 1, ring: null })
  await act(m, { type: 'token/update', id: await idOf(m, 'Porta'), movement: 'locked' })
  await place(m, t.square, 'Guerreira', 1, 450, 150)
  await act(m, { type: 'token/owner', id: await idOf(m, 'Guerreira'), owner: 'Ana' })
  await act(m, { type: 'token/place', hash: t.square, name: 'Bau', kind: 'object', x: 550, y: 150, width: 1, ring: null })
  await act(m, { type: 'token/update', id: await idOf(m, 'Bau'), movement: 'master' })
  await place(m, t.square, 'Espiao', 1, 450, 250)
  await act(m, { type: 'token/hide', id: await idOf(m, 'Espiao') })
  await item(t.player.page, 'Bau')
  return t
}

test('[C8] BRD-08 a box selects exactly the items whose centre is inside and that the person may move', async () => {
  const { master, player } = await crowd()
  // the master: the three goblins, not the locked door; the box edge cuts the chest's body but not its centre
  await boxDrag(master.page, 90, 90, 300, 300)
  await expect.poll(() => ids(master.page)).toEqual(await idsOf(master.page, 'G1', 'G2', 'G3'))
  await boxDrag(master.page, 400, 100, 590, 300)
  await expect.poll(() => ids(master.page)).toEqual(await idsOf(master.page, 'Guerreira', 'Bau', 'Espiao'))
  // Ana: her character and the free goblins; not the master-only chest nor the spy she cannot see
  await boxDrag(player.page, 90, 90, 590, 300)
  await expect.poll(() => ids(player.page)).toEqual(await idsOf(player.page, 'G1', 'G2', 'G3', 'Guerreira'))
  expect(await ids(master.page)).toEqual(await idsOf(master.page, 'Guerreira', 'Bau', 'Espiao')) // each window its own
})

test('[C9] BRD-09 Shift+click adds an item the person may move, and takes it out again', async () => {
  const { master } = await crowd()
  await clickItem(master.page, 'G1')
  await clickItem(master.page, 'G2', ['Shift'])
  await expect.poll(() => ids(master.page)).toEqual(await idsOf(master.page, 'G1', 'G2'))
  await clickItem(master.page, 'Bau', ['Shift'])
  await expect.poll(() => ids(master.page)).toEqual(await idsOf(master.page, 'G1', 'G2', 'Bau'))
  await clickItem(master.page, 'G1', ['Shift'])
  await expect.poll(() => ids(master.page)).toEqual(await idsOf(master.page, 'G2', 'Bau'))
  await clickItem(master.page, 'Porta', ['Shift']) // locked: not added
  await master.page.waitForTimeout(200)
  expect(await ids(master.page)).toEqual(await idsOf(master.page, 'G2', 'Bau'))
})

test('[C10] BRD-10 dragging one of several selected items moves them all by the same offset, in every window', async () => {
  const { master, player } = await crowd()
  await boxDrag(master.page, 90, 90, 300, 200) // G1, G2
  await clickItem(master.page, 'G3', ['Shift'])
  await clickItem(master.page, 'Guerreira', ['Shift'])
  await expect.poll(async () => (await ids(master.page)).length).toBe(4)
  await dragItem(master.page, 'G1', 330, 370) // lands centred on (350, 350): +200, +200
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'G1')).toEqual([350, 350])
    await expect.poll(() => centre(page, 'G2')).toEqual([450, 350])
    await expect.poll(() => centre(page, 'G3')).toEqual([350, 450])
    await expect.poll(() => centre(page, 'Guerreira')).toEqual([650, 350])
    expect(await centre(page, 'Porta')).toEqual([250, 250]) // not selected: stays
  }
})

test('[C11] BRD-11 Q and E turn each selected item 15° about its own centre, in every window', async () => {
  const { master, player } = await crowd()
  await boxDrag(master.page, 90, 90, 300, 200) // G1, G2
  await expect.poll(async () => (await ids(master.page)).length).toBe(2)
  await master.page.keyboard.press('e')
  for (const page of [master.page, player.page]) for (const n of ['G1', 'G2']) await expect.poll(async () => (await item(page, n)).rotation).toBe(15)
  await master.page.keyboard.press('q')
  await master.page.keyboard.press('q')
  for (const page of [master.page, player.page]) {
    for (const n of ['G1', 'G2']) await expect.poll(async () => (await item(page, n)).rotation).toBe(345)
    expect(await centre(page, 'G1')).toEqual([150, 150]) // about its own centre
    expect((await item(page, 'G3')).rotation).toBe(0)
  }
})

test('[C12] BRD-12 the master\'s Delete removes the selected items in every window; a player\'s removes nothing', async () => {
  const { master, player } = await crowd()
  await boxDrag(player.page, 90, 90, 300, 200) // G1, G2 for Ana
  await expect.poll(async () => (await ids(player.page)).length).toBe(2)
  await player.page.keyboard.press('Delete')
  await player.page.waitForTimeout(400)
  expect((await snap(master.page)).tokens.map((t) => t.name)).toContain('G1')
  await boxDrag(master.page, 90, 90, 300, 200)
  await expect.poll(async () => (await ids(master.page)).length).toBe(2)
  await master.page.keyboard.press('Delete')
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.map((t) => t.name).filter((n) => n === 'G1' || n === 'G2')).toEqual([])
    expect((await snap(page)).tokens.map((t) => t.name)).toContain('G3')
  }
})

test('[C13] BRD-13 a click on the empty map or Esc clears the selection', async () => {
  const { master } = await crowd()
  await boxDrag(master.page, 90, 90, 300, 300)
  await expect.poll(async () => (await ids(master.page)).length).toBe(3)
  const empty = await at(master.page, 650, 450)
  await master.page.mouse.click(empty.x, empty.y)
  await expect.poll(() => ids(master.page)).toEqual([])
  await boxDrag(master.page, 90, 90, 300, 300)
  await expect.poll(async () => (await ids(master.page)).length).toBe(3)
  await master.page.keyboard.press('Escape')
  await expect.poll(() => ids(master.page)).toEqual([])
})

test('[C14] BRD-14 each selected item is outlined, and the master\'s editor hides with several', async () => {
  const { master } = await crowd()
  await showPanel(master.page, 'tokens')
  await clickItem(master.page, 'G1')
  await expect(master.page.getByTestId('token-editor')).toBeVisible()
  await expect.poll(async () => (await snap(master.page)).selection.outlines).toBe(1)
  await boxDrag(master.page, 90, 90, 300, 300)
  await expect.poll(async () => (await snap(master.page)).selection.outlines).toBe(3)
  await expect(master.page.getByTestId('token-editor')).toBeHidden()
  expect((await snap(master.page)).selection.handle).toBeNull() // no resize handle with several
  await clickItem(master.page, 'G2') // a click on one of them: just it
  await expect.poll(() => ids(master.page)).toEqual([await idOf(master.page, 'G2')])
  await expect(master.page.getByTestId('token-editor')).toBeVisible()
})

/** The groups on the table, read from the master's server: name → group (null when alone). */
async function groups(master: AppHandle): Promise<Record<string, string | null>> {
  return master.app.evaluate(() => {
    const scene = (globalThis as { __mesaServer?: { getScene(): { tokens: Record<string, { name: string; group?: string | null }> } } }).__mesaServer!.getScene()
    return Object.fromEntries(Object.values(scene.tokens).map((t) => [t.name, t.group ?? null]))
  })
}
/** Ana's Guerreira and a free Cavalo; a "Só mestre" Bau; two free goblins. */
async function stable(): Promise<{ master: AppHandle; player: AppHandle }> {
  const t = await table()
  const m = t.master.page
  await place(m, t.square, 'Guerreira', 1, 150, 150)
  await act(m, { type: 'token/owner', id: await idOf(m, 'Guerreira'), owner: 'Ana' })
  await place(m, t.square, 'Cavalo', 1, 250, 150)
  await act(m, { type: 'token/place', hash: t.square, name: 'Bau', kind: 'object', x: 450, y: 150, width: 1, ring: null })
  await act(m, { type: 'token/update', id: await idOf(m, 'Bau'), movement: 'master' })
  await place(m, t.square, 'G1', 1, 150, 450)
  await place(m, t.square, 'G2', 1, 250, 450)
  await place(m, t.square, 'G3', 1, 350, 450)
  await item(t.player.page, 'G3')
  return t
}

test('[C15] BRD-15 "Agrupar" (or Ctrl+G) groups the selected items, which leave any group they were in', async () => {
  const { master, player } = await stable()
  await boxDrag(player.page, 90, 90, 300, 200) // Guerreira and Cavalo, for Ana
  await expect(player.page.getByTestId('group')).toBeVisible()
  await player.page.getByTestId('group').click()
  await expect.poll(async () => { const g = await groups(master); return !!g.Guerreira && g.Guerreira === g.Cavalo }).toBe(true)
  expect((await groups(master)).Bau).toBeNull()
  // the master regroups with Ctrl+G: G1+G2, then G2+G3 takes G2 out of the first group, which ends
  await boxDrag(master.page, 90, 390, 300, 510)
  await master.page.keyboard.press('Control+g')
  await expect.poll(async () => { const g = await groups(master); return !!g.G1 && g.G1 === g.G2 }).toBe(true)
  await master.page.keyboard.press('Escape')
  await boxDrag(master.page, 190, 390, 410, 510)
  await master.page.keyboard.press('Control+g')
  await expect.poll(async () => { const g = await groups(master); return [!!g.G2 && g.G2 === g.G3, g.G1] }).toEqual([true, null])
})

test('[C16] BRD-16 grouping an item the person may not move is refused with "Sem permissão" and changes nothing', async () => {
  const { master, player } = await stable()
  // the box and Shift+click leave out what Ana may not move, so "Agrupar" never offers it; the table refuses it too
  const ids2 = await idsOf(player.page, 'Guerreira', 'Bau')
  expect(await player.page.evaluate((ids) => window.__mesaTest!.send({ type: 'token/group', ids }), ids2)).toEqual({ ok: false, reason: 'Sem permissão' })
  await boxDrag(player.page, 90, 90, 500, 200)
  await expect.poll(() => ids(player.page)).toEqual(await idsOf(player.page, 'Guerreira', 'Cavalo')) // the chest is not taken
  expect(Object.values(await groups(master)).every((g) => g === null)).toBe(true)
})

test('[C17] BRD-17 a click on a grouped item selects the whole group, and dragging it moves the group in every window', async () => {
  const { master, player } = await stable()
  await boxDrag(player.page, 90, 90, 300, 200)
  await player.page.getByTestId('group').click()
  await expect.poll(async () => !!(await groups(master)).Cavalo).toBe(true)
  await player.page.keyboard.press('Escape')
  await clickItem(player.page, 'Cavalo')
  await expect.poll(() => ids(player.page)).toEqual(await idsOf(player.page, 'Guerreira', 'Cavalo'))
  await player.page.keyboard.press('Escape')
  await dragItem(player.page, 'Cavalo', 260, 330) // grabbed with nothing selected: +0, +200
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'Cavalo')).toEqual([250, 350])
    await expect.poll(() => centre(page, 'Guerreira')).toEqual([150, 350])
  }
})

test('[C18] BRD-18 a group with an item the person may not move does not move for them and shows "Sem permissão"', async () => {
  const { master, player } = await stable()
  await clickItem(master.page, 'Guerreira')
  await clickItem(master.page, 'Bau', ['Shift'])
  await master.page.getByTestId('group').click()
  await expect.poll(async () => { const g = await groups(master); return !!g.Bau && g.Bau === g.Guerreira }).toBe(true)
  await dragItem(player.page, 'Guerreira', 150, 350)
  await expect(player.page.getByTestId('group-message')).toHaveText('Sem permissão')
  await player.page.waitForTimeout(300)
  for (const page of [master.page, player.page]) {
    expect(await centre(page, 'Guerreira')).toEqual([150, 150])
    expect(await centre(page, 'Bau')).toEqual([450, 150])
  }
  // the master moves it whole
  await dragItem(master.page, 'Bau', 450, 350)
  for (const page of [master.page, player.page]) {
    await expect.poll(() => centre(page, 'Bau')).toEqual([450, 350])
    await expect.poll(() => centre(page, 'Guerreira')).toEqual([150, 350])
  }
})

test('[C19] BRD-19 "Desagrupar" (or Ctrl+Shift+G) ungroups a group the person may move whole; otherwise "Sem permissão"', async () => {
  const { master, player } = await stable()
  await boxDrag(player.page, 90, 90, 300, 200)
  await player.page.keyboard.press('Control+g')
  await expect.poll(async () => !!(await groups(master)).Cavalo).toBe(true)
  await player.page.keyboard.press('Escape')
  await clickItem(player.page, 'Guerreira') // selects the group
  await expect(player.page.getByTestId('ungroup')).toBeVisible()
  await expect(player.page.getByTestId('group')).toBeHidden()
  await player.page.getByTestId('ungroup').click()
  await expect.poll(async () => { const g = await groups(master); return [g.Guerreira, g.Cavalo] }).toEqual([null, null])
  // a group holding the master-only chest: Ana's ungroup is refused, the master's Ctrl+Shift+G works
  await boxDrag(master.page, 90, 90, 500, 200)
  await master.page.keyboard.press('Control+g')
  await expect.poll(async () => !!(await groups(master)).Bau).toBe(true)
  await clickItem(player.page, 'Guerreira')
  await expect.poll(async () => (await ids(player.page)).length).toBe(3)
  await player.page.getByTestId('ungroup').click()
  await expect(player.page.getByTestId('group-message')).toHaveText('Sem permissão')
  expect(!!(await groups(master)).Bau).toBe(true)
  await master.page.keyboard.press('Control+Shift+g')
  await expect.poll(async () => Object.values(await groups(master)).every((g) => g === null)).toBe(true)
})

test('[C20] BRD-20 groups come back as saved when a scene is loaded', async () => {
  const { master } = await stable()
  await boxDrag(master.page, 90, 90, 300, 200)
  await master.page.getByTestId('group').click()
  await expect.poll(async () => !!(await groups(master)).Cavalo).toBe(true)
  const saved = await groups(master)
  await saveScene(master.page, 'Estábulo')
  await clickItem(master.page, 'Cavalo')
  await master.page.getByTestId('ungroup').click()
  await expect.poll(async () => (await groups(master)).Cavalo).toBeNull()
  await master.page.getByTestId('scene-item').filter({ hasText: 'Estábulo' }).click()
  await master.page.getByTestId('confirm-yes').click()
  await expect.poll(() => groups(master)).toEqual(saved)
})

const overlays = (page: Page) => page.evaluate(() => window.__mesaTest!.overlays())
/** A right-button drag on the map from (x0, y0) to (x1, y1), map pixels; returns the camera before and after. */
async function rightDrag(page: Page, x0: number, y0: number, dxPx: number, dyPx: number) {
  const before = (await snap(page)).camera
  const a = await at(page, x0, y0)
  await page.mouse.move(a.x, a.y)
  await page.mouse.down({ button: 'right' })
  await page.mouse.move(a.x + dxPx, a.y + dyPx, { steps: 8 })
  await page.mouse.up({ button: 'right' })
  return { before, after: (await snap(page)).camera }
}

test('[C22] BRD-22 a right-button drag pans the view in any tool, and the tool does nothing', async () => {
  const { master, player, square } = await table()
  await place(master.page, square, 'G1', 1, 150, 150)
  await item(player.page, 'G1')
  // select tool, starting on a token: the view moves, the token does not, nothing is selected
  let r = await rightDrag(master.page, 150, 150, 120, 80)
  expect(r.after.x - r.before.x).toBeCloseTo(120, 0)
  expect(r.after.y - r.before.y).toBeCloseTo(80, 0)
  expect(await centre(master.page, 'G1')).toEqual([150, 150])
  expect(await ids(master.page)).toEqual([])
  // select tool on the empty map: no selection box either
  r = await rightDrag(master.page, 600, 400, -60, 0)
  expect(r.after.x - r.before.x).toBeCloseTo(-60, 0)
  expect(await ids(master.page)).toEqual([])
  // the ruler and the drawing tool: the view moves, no ruler and no stroke in either window
  for (const tool of ['ruler', 'draw'] as const) {
    await master.page.getByTestId(`tool-${tool}`).click()
    r = await rightDrag(master.page, 450, 300, -100, 50)
    expect(r.after.x - r.before.x, tool).toBeCloseTo(-100, 0)
    expect(r.after.y - r.before.y, tool).toBeCloseTo(50, 0)
    await master.page.waitForTimeout(300)
    for (const page of [master.page, player.page]) {
      const o = await overlays(page)
      expect([o.rulers.length, o.strokes.length], tool).toEqual([0, 0])
    }
  }
  expect(await centre(player.page, 'G1')).toEqual([150, 150])
})

test('[C23] BRD-23 a right click on the map opens no context menu', async () => {
  const { master } = await table()
  await master.page.evaluate(() => {
    const w = window as unknown as { contextMenus: boolean[] }
    w.contextMenus = []
    document.addEventListener('contextmenu', (e) => w.contextMenus.push(e.defaultPrevented)) // after the canvas had its say
  })
  const p = await at(master.page, 300, 300)
  await master.page.mouse.click(p.x, p.y, { button: 'right' })
  await expect.poll(() => master.page.evaluate(() => (window as unknown as { contextMenus: boolean[] }).contextMenus)).toEqual([true])
})
