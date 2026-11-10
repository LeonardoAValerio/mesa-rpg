import { expect, test, type Page } from '@playwright/test'
import { existsSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { act, campaignDir, closeAll, masterAndPlayer, nextOpenDialog, putAsset, putFile, showPanel, snap, solidPng, type AppHandle } from './helpers'
import { tokenFolder } from './fixtures'

test.afterEach(closeAll)

const names = (page: Page, list: string) => page.getByTestId(`list-${list}`).getByTestId(list === 'mapas' ? 'map-name' : 'library-name')

test('[C8] CAMP-08 Tokens lists the images of tokens/ and objetos/ with a thumbnail and the name; objetos/ are objects unless the .json says otherwise', async () => {
  const { master } = await masterAndPlayer()
  putFile(master, 'tokens/goblin.png', solidPng(64, 64, [200, 30, 30]))
  putFile(master, 'tokens/porta.png', solidPng(64, 16))
  putFile(master, 'tokens/porta.json', JSON.stringify({ tipo: 'objeto' }))
  putFile(master, 'objetos/bau.png', solidPng(48, 32, [120, 80, 20]))
  putFile(master, 'objetos/estatua.png', solidPng(32, 64))
  putFile(master, 'objetos/estatua.json', JSON.stringify({ tipo: 'personagem' }))
  await showPanel(master.page, 'tokens')
  await expect(names(master.page, 'tokens')).toHaveText(['goblin', 'porta'], { timeout: 5000 })
  await expect(names(master.page, 'objetos')).toHaveText(['bau', 'estatua'])
  const kind = (list: string, name: string) => master.page.getByTestId(`list-${list}`).getByTestId('library-item').filter({ hasText: name })
  await expect(kind('tokens', 'goblin')).toHaveAttribute('data-kind', 'character')
  await expect(kind('tokens', 'porta')).toHaveAttribute('data-kind', 'object')
  await expect(kind('objetos', 'bau')).toHaveAttribute('data-kind', 'object')
  await expect(kind('objetos', 'estatua')).toHaveAttribute('data-kind', 'character')
  // each row has a thumbnail drawn from the image
  for (const n of ['goblin', 'bau']) await expect(master.page.getByTestId('library-item').filter({ hasText: n }).getByTestId('thumb')).toHaveAttribute('data-drawn', 'true')
})

test('[C9] CAMP-09 Mapas lists the images of mapas/ with a thumbnail and the name', async () => {
  const { master } = await masterAndPlayer()
  putFile(master, 'mapas/Florestas.png', solidPng(80, 60, [40, 90, 40]))
  putFile(master, 'mapas/Castelo.webp.txt', 'não é imagem')
  await showPanel(master.page, 'mapas')
  await expect(names(master.page, 'mapas')).toHaveText(['Florestas'], { timeout: 5000 })
  await expect(master.page.getByTestId('map-item').getByTestId('thumb')).toHaveAttribute('data-drawn', 'true')
})

test('[C10] CAMP-10 subfolders show as groups titled with their path, which open and close', async () => {
  const { master } = await masterAndPlayer()
  putFile(master, 'tokens/Goblins/goblin.png', solidPng(32, 32))
  putFile(master, 'tokens/Goblins/Chefes/rei.png', solidPng(32, 32))
  putFile(master, 'tokens/elfa.png', solidPng(32, 32))
  await showPanel(master.page, 'tokens')
  const group = (g: string) => master.page.getByTestId(`group-tokens-${g}`)
  await expect(group('Goblins')).toBeVisible({ timeout: 5000 })
  await expect(group('Goblins').locator('summary')).toHaveText('Goblins')
  await expect(group('Goblins/Chefes').locator('summary')).toHaveText('Goblins/Chefes')
  await expect(group('Goblins').getByTestId('library-name')).toHaveText(['goblin'])
  await expect(group('Goblins/Chefes').getByTestId('library-name')).toHaveText(['rei'])
  await group('Goblins').locator('summary').click()
  await expect(group('Goblins').getByTestId('library-item')).toBeHidden()
  await group('Goblins').locator('summary').click()
  await expect(group('Goblins').getByTestId('library-item')).toBeVisible()
})

test('[C11] CAMP-11 files added, renamed and removed outside the app show in the lists within 2 seconds', async () => {
  const { master } = await masterAndPlayer()
  await showPanel(master.page, 'tokens')
  const dir = campaignDir(master)
  putFile(master, 'tokens/goblin.png', solidPng(32, 32))
  await expect(names(master.page, 'tokens')).toHaveText(['goblin'], { timeout: 2500 })
  renameSync(join(dir, 'tokens', 'goblin.png'), join(dir, 'tokens', 'orc.png'))
  await expect(names(master.page, 'tokens')).toHaveText(['orc'], { timeout: 2500 })
  rmSync(join(dir, 'tokens', 'orc.png'))
  await expect(names(master.page, 'tokens')).toHaveCount(0, { timeout: 2500 })
})

test('[C12] CAMP-12 a token or object dragged from the list lands on the map in every window, an object as an object', async () => {
  const { master, player } = await masterAndPlayer()
  const map = await putAsset(master.app, solidPng(800, 600, [40, 90, 40]))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100, offsetX: 0, offsetY: 0 } })
  putFile(master, 'objetos/bau.png', solidPng(64, 32, [120, 80, 20]))
  await showPanel(master.page, 'tokens')
  await expect(names(master.page, 'objetos')).toHaveText(['bau'], { timeout: 5000 })
  const s = await snap(master.page)
  await master.page.getByTestId('library-item').filter({ hasText: 'bau' }).dragTo(master.page.getByTestId('board-canvas'), { targetPosition: { x: 433 * s.camera.scale + s.camera.x, y: 211 * s.camera.scale + s.camera.y } })
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).tokens.map((t) => t.kind)).toEqual(['object'])
    const t = (await snap(page)).tokens[0]
    expect(Math.abs(t.x - 433)).toBeLessThan(1.5) // an object stays where dropped
    expect(t.name).toBe('bau')
  }
  await expect.poll(async () => (await snap(player.page)).tokens[0]?.textured).toBe(true) // the player downloads it
})

test('[C13] CAMP-13 a map clicked in the list loads in every window, with its grid detected', async () => {
  const { master, player } = await masterAndPlayer()
  putFile(master, 'mapas/Florestas.png', solidPng(800, 600, [40, 90, 40]))
  await showPanel(master.page, 'mapas')
  await master.page.getByTestId('map-item').filter({ hasText: 'Florestas' }).click({ timeout: 5000 })
  for (const page of [master.page, player.page]) {
    await expect.poll(async () => (await snap(page)).map).toMatchObject({ width: 800, height: 600 })
  }
  await expect.poll(async () => (await snap(player.page)).map?.textured, { timeout: 10_000 }).toBe(true)
})

test('[C14] CAMP-14 "Adicionar arquivos" copies into the section, naming repeats (2), (3)', async () => {
  const { master } = await masterAndPlayer()
  const src = tokenFolder(`add-${Date.now()}`, { 'goblin.png': solidPng(32, 32, [1, 2, 3]) })
  await showPanel(master.page, 'tokens')
  for (let i = 0; i < 3; i++) {
    await nextOpenDialog(master.app, [join(src, 'goblin.png')])
    await master.page.getByTestId('add-tokens').click()
  }
  await expect(names(master.page, 'tokens')).toHaveText(['goblin', 'goblin (2)', 'goblin (3)'], { timeout: 5000 })
  expect(readdirSync(join(campaignDir(master), 'tokens')).sort()).toEqual(['goblin (2).png', 'goblin (3).png', 'goblin.png'])
  // objects go to objetos/
  await nextOpenDialog(master.app, [join(src, 'goblin.png')])
  await master.page.getByTestId('add-objetos').click()
  await expect(names(master.page, 'objetos')).toHaveText(['goblin'], { timeout: 5000 })
})

/** A map and two items from the campaign, on the table of both windows. */
async function setUp(): Promise<{ master: AppHandle; player: AppHandle }> {
  const t = await masterAndPlayer('Ana')
  putFile(t.master, 'mapas/Floresta.png', solidPng(800, 600, [40, 90, 40]))
  putFile(t.master, 'tokens/Goblins/goblin.png', solidPng(64, 64, [200, 30, 30]))
  putFile(t.master, 'objetos/bau.png', solidPng(64, 32, [120, 80, 20]))
  await showPanel(t.master.page, 'mapas')
  await t.master.page.getByTestId('map-item').filter({ hasText: 'Floresta' }).click({ timeout: 5000 })
  await expect.poll(async () => (await snap(t.master.page)).map?.width).toBe(800)
  const entries = await t.master.page.evaluate(() => window.mesa.campaign())
  const hash = (path: string) => entries!.entries.find((e) => e.path === path)!.hash
  await act(t.master.page, { type: 'token/place', hash: hash('tokens/Goblins/goblin.png'), name: 'goblin', kind: 'character', x: 150, y: 150, width: 1, ring: 'inimigo' })
  await act(t.master.page, { type: 'token/place', hash: hash('objetos/bau.png'), name: 'bau', kind: 'object', x: 450, y: 250, width: 1, ring: null })
  return t
}
async function saveAs(page: Page, name: string): Promise<void> {
  await page.getByTestId('save-scene').click()
  await page.getByTestId('scene-name').fill(name)
  await page.getByTestId('scene-name-ok').click()
}
const items = async (page: Page): Promise<string[]> => (await snap(page)).tokens.map((t) => t.name).sort()

test('[C18] CAMP-18 Mapas lists the scenes and a pick loads it in every window, asking first when the table has items', async () => {
  const { master, player } = await setUp()
  await saveAs(master.page, 'Emboscada')
  await expect(master.page.getByTestId('scene-item')).toHaveText(['Emboscada'], { timeout: 5000 })
  expect(readdirSync(join(campaignDir(master), 'cenas'))).toEqual(['Emboscada.cena']) // CAMP-16 on disk
  // change the table: remove the chest, move the goblin
  const now = await snap(master.page)
  await act(master.page, { type: 'token/remove', id: now.tokens.find((t) => t.name === 'bau')!.id })
  await expect.poll(() => items(player.page)).toEqual(['goblin'])
  await master.page.getByTestId('scene-item').filter({ hasText: 'Emboscada' }).click()
  await expect(master.page.getByTestId('confirm-message')).toHaveText('Substituir a cena atual?') // SAVE-05
  await master.page.getByTestId('confirm-no').click()
  expect(await items(master.page)).toEqual(['goblin'])
  await master.page.getByTestId('scene-item').filter({ hasText: 'Emboscada' }).click()
  await master.page.getByTestId('confirm-yes').click()
  for (const page of [master.page, player.page]) await expect.poll(() => items(page)).toEqual(['bau', 'goblin'])
  await expect.poll(async () => (await snap(player.page)).map?.textured, { timeout: 10_000 }).toBe(true)
})

test('[C17] CAMP-17 saving under an existing name asks "Substituir a cena <nome>?" and writes only if confirmed', async () => {
  const { master } = await setUp()
  await saveAs(master.page, 'Emboscada')
  await expect(master.page.getByTestId('scene-item')).toHaveText(['Emboscada'], { timeout: 5000 })
  const file = join(campaignDir(master), 'cenas', 'Emboscada.cena')
  const before = readFileSync(file, 'utf8')
  await act(master.page, { type: 'token/remove', id: (await snap(master.page)).tokens.find((t) => t.name === 'bau')!.id })
  await saveAs(master.page, 'emboscada')
  await expect(master.page.getByTestId('confirm-message')).toHaveText('Substituir a cena emboscada?')
  await master.page.getByTestId('confirm-no').click()
  expect(readFileSync(file, 'utf8')).toBe(before)
  await saveAs(master.page, 'Emboscada')
  await master.page.getByTestId('confirm-yes').click()
  await expect.poll(() => readFileSync(file, 'utf8')).not.toBe(before)
  expect(readdirSync(join(campaignDir(master), 'cenas'))).toEqual(['Emboscada.cena'])
})

test('[C19] CAMP-19 a scene whose token file was deleted does not load and shows "Arquivo não encontrado: <caminho>"', async () => {
  const { master, player } = await setUp()
  await saveAs(master.page, 'Emboscada')
  await expect(master.page.getByTestId('scene-item')).toHaveText(['Emboscada'], { timeout: 5000 })
  await act(master.page, { type: 'token/remove', id: (await snap(master.page)).tokens.find((t) => t.name === 'bau')!.id })
  rmSync(join(campaignDir(master), 'tokens', 'Goblins', 'goblin.png'))
  await master.page.getByTestId('scene-item').filter({ hasText: 'Emboscada' }).click()
  await master.page.getByTestId('confirm-yes').click()
  await expect(master.page.getByTestId('scene-message')).toHaveText('Arquivo não encontrado: tokens/Goblins/goblin.png')
  expect(await items(player.page)).toEqual(['goblin']) // nothing changed
})

test('[C21] CAMP-21 "Exportar .mesa" saves the full file with the images, and "Importar .mesa" loads it', async () => {
  const { master, player } = await setUp()
  const out = join(campaignDir(master), '..', 'fora.mesa')
  await master.app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () => ({ canceled: false, filePath: p })) as typeof dialog.showSaveDialog
  }, out)
  await master.page.getByTestId('export-mesa').click()
  await expect.poll(() => existsSync(out)).toBe(true)
  const file = JSON.parse(readFileSync(out, 'utf8'))
  expect(Object.keys(file.assets)).toHaveLength(3) // map, goblin and chest embedded
  await act(master.page, { type: 'token/remove', id: (await snap(master.page)).tokens.find((t) => t.name === 'bau')!.id })
  await nextOpenDialog(master.app, [out])
  await master.page.getByTestId('import-mesa').click()
  await master.page.getByTestId('confirm-yes').click()
  for (const page of [master.page, player.page]) await expect.poll(() => items(page)).toEqual(['bau', 'goblin'])
})
