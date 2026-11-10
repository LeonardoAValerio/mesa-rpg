import { expect, test, type Page } from '@playwright/test'
import { act, closeAll, showPanel, masterAndPlayer, putAsset, screenOf, snap, solidPng, type AppHandle } from './helpers'

test.afterEach(closeAll)

/** 800x600 map, 100 px cells, Guerreira (grupo) at (1,1) and Goblin (inimigo) at (3,3). */
async function table(): Promise<{ master: AppHandle; player: AppHandle; id: (name: string) => Promise<string> }> {
  const { master, player } = await masterAndPlayer('Ana')
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  const tok = await putAsset(master.app, solidPng(32, 32, [200, 200, 200]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  await act(master.page, { type: 'fog/revealAll' }) // a no-op since FOGD-01 (a new map has no fog); kept so the board is open either way
  await act(master.page, { type: 'token/place', hash: tok, name: 'Guerreira', kind: 'character', x: 150, y: 150, width: 1, ring: 'grupo' })
  await act(master.page, { type: 'token/place', hash: tok, name: 'Goblin', kind: 'character', x: 350, y: 350, width: 1, ring: 'inimigo' })
  await expect.poll(async () => (await snap(player.page)).tokens.length).toBe(2)
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.every((t) => t.textured) && (await snap(page)).map?.textured).toBe(true)
  }
  const id = async (name: string): Promise<string> => (await snap(master.page)).tokens.find((t) => t.name === name)!.id
  await showPanel(master.page, 'tokens') // the item editor lives there
  return { master, player, id }
}
async function click(page: Page, x: number, y: number): Promise<void> {
  const p = await screenOf(page, x, y)
  await page.mouse.click(p.x, p.y)
}
const names = async (page: Page): Promise<string[]> => (await snap(page)).tokens.map((t) => t.name).sort()

test('[C43] PERM-01 the master picks "Ana" as owner of the Guerreira and the token shows "Ana" in the master window', async () => {
  const { master, player } = await table()
  await click(master.page, 150, 150)
  await expect(master.page.getByTestId('token-editor')).toBeVisible()
  await master.page.getByTestId('token-owner').selectOption('Ana')
  await expect.poll(async () => (await snap(master.page)).tokens.find((t) => t.name === 'Guerreira')?.label).toBe('Guerreira (Ana)')
  await expect.poll(async () => (await snap(player.page)).tokens.find((t) => t.name === 'Guerreira')?.owner).toBe('Ana')
})

test('[C32] TOK-07 the master renames the token to "Chefe" and both windows show "Chefe"', async () => {
  const { master, player } = await table()
  await click(master.page, 350, 350)
  await master.page.getByTestId('token-name').fill('Chefe')
  await master.page.getByTestId('token-name').press('Enter')
  for (const page of [master.page, player.page]) await expect.poll(() => names(page)).toEqual(['Chefe', 'Guerreira'])
  await master.page.getByTestId('token-ring').selectOption('npc')
  await master.page.getByTestId('token-size').fill('2')
  await master.page.getByTestId('token-size').press('Enter')
  await expect.poll(async () => (await snap(player.page)).tokens.find((t) => t.name === 'Chefe')).toMatchObject({ ring: '#eab308', w: 200 })
})

test('[C33] TOK-08 the master removes a token and it disappears from both windows', async () => {
  const { master, player } = await table()
  await click(master.page, 350, 350)
  await master.page.getByTestId('token-remove').click()
  for (const page of [master.page, player.page]) await expect.poll(() => names(page)).toEqual(['Guerreira'])
  await expect(master.page.getByTestId('token-editor')).toBeHidden()
})

test('[C47] PERM-05 a hidden token disappears from the player window and has alpha 0.5 in the master window', async () => {
  const { master, player } = await table()
  await click(master.page, 350, 350)
  await master.page.getByTestId('token-hide').click()
  await expect.poll(() => names(player.page)).toEqual(['Guerreira'])
  await expect.poll(async () => (await snap(master.page)).tokens.find((t) => t.name === 'Goblin')?.alpha).toBe(0.5)
  await expect(master.page.getByTestId('token-hide')).toHaveText('Mostrar')
})

test('[C48] PERM-06 showing the hidden token makes it appear again in the player window', async () => {
  const { master, player } = await table()
  await click(master.page, 350, 350)
  await master.page.getByTestId('token-hide').click()
  await expect.poll(() => names(player.page)).toEqual(['Guerreira'])
  await master.page.getByTestId('token-hide').click()
  await expect.poll(() => names(player.page)).toEqual(['Goblin', 'Guerreira'])
  await expect.poll(async () => (await snap(master.page)).tokens.find((t) => t.name === 'Goblin')?.alpha).toBe(1)
})

test('Ana drags the Livre Guerreira and cannot drag the Goblin once it is "Só mestre" (ITEM-14, ITEM-15)', async () => {
  const { master, player, id } = await table()
  await act(master.page, { type: 'token/update', id: await id('Goblin'), movement: 'master' })
  await player.page.waitForTimeout(300)
  const drag = async (fx: number, fy: number, tx: number, ty: number): Promise<void> => {
    const a = await screenOf(player.page, fx, fy)
    const b = await screenOf(player.page, tx, ty)
    await player.page.mouse.move(a.x, a.y)
    await player.page.mouse.down()
    await player.page.mouse.move(b.x, b.y, { steps: 6 })
    await player.page.mouse.up()
  }
  await drag(150, 150, 570, 170) // edges land at (520, 120) and snap to (500, 100): centre (550, 150)
  for (const page of [player.page, master.page]) {
    await expect.poll(async () => (await snap(page)).tokens.find((t) => t.name === 'Guerreira')).toMatchObject({ x: 550, y: 150 })
  }
  await drag(350, 350, 650, 450)
  await player.page.waitForTimeout(300)
  for (const page of [player.page, master.page]) {
    expect((await snap(page)).tokens.find((t) => t.name === 'Goblin')).toMatchObject({ x: 350, y: 350 })
  }
})

test('[C36] TOK-11 when the master removes a token while the player is dragging it, the drag is cancelled', async () => {
  const { master, player, id } = await table()
  const g = await id('Guerreira')
  await act(master.page, { type: 'token/owner', id: g, owner: 'Ana' })
  await expect.poll(async () => (await snap(player.page)).tokens.find((t) => t.name === 'Guerreira')?.owner).toBe('Ana')
  const a = await screenOf(player.page, 150, 150)
  await player.page.mouse.move(a.x, a.y)
  await player.page.mouse.down()
  await player.page.mouse.move(a.x + 60, a.y + 40, { steps: 4 })
  expect((await snap(player.page)).dragging).toBe(g)
  await act(master.page, { type: 'token/remove', id: g })
  await expect.poll(async () => (await snap(player.page)).dragging).toBeNull()
  expect(await names(player.page)).toEqual(['Goblin'])
  await player.page.mouse.up()
  await player.page.waitForTimeout(200)
  expect(await names(master.page)).toEqual(['Goblin'])
})

test('[C79] TOK-12 a master click on a token right after a scene update selects it, 10 times out of 10', async () => {
  const { master } = await table()
  const tok = await putAsset(master.app, solidPng(32, 32, [90, 90, 90]))
  for (let i = 0; i < 10; i++) {
    const col = i % 8
    const row = 5
    await act(master.page, { type: 'token/place', hash: tok, name: `T${i}`, kind: 'character', x: col * 100 + 50, y: row * 100 + 50, width: 1, ring: 'npc' })
    await click(master.page, col * 100 + 50, row * 100 + 50) // no wait: the update and the click race
    await expect(master.page.getByTestId('token-editor').locator('h3')).toHaveText(`Personagem: T${i}`)
    await act(master.page, { type: 'token/remove', id: (await snap(master.page)).tokens.find((t) => t.name === `T${i}`)!.id })
  }
})
