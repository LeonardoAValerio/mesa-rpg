import { expect, test } from '@playwright/test'
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { closeAll, freePort, host, launch, showPanel } from './helpers'

test.afterEach(closeAll)

const docs = (userData: string): string => join(userData, 'Documentos', 'Mesa RPG')

test('[C1] CAMP-01 the start screen lists the folders in Documentos/Mesa RPG as campaigns, creating it when missing', async () => {
  const app = await launch({ campaign: false })
  await expect(app.page.getByTestId('no-campaigns')).toHaveText('Nenhuma campanha ainda')
  expect(existsSync(docs(app.userData))).toBe(true) // created on the first look
  mkdirSync(join(docs(app.userData), 'Zeta'))
  mkdirSync(join(docs(app.userData), 'Alfa'))
  await app.app.close()
  const again = await launch({ userData: app.userData })
  await expect(again.page.getByTestId('campaigns').locator('label')).toHaveText(['Alfa', 'Zeta'])
})

test('[C2] CAMP-02 "Nova campanha" creates the campaign with its six folders and selects it', async () => {
  const app = await launch({ campaign: false })
  await app.page.getByTestId('new-campaign-name').fill('Florestas Frias')
  await app.page.getByTestId('new-campaign').click()
  await expect(app.page.getByTestId('campaign-Florestas Frias').locator('input')).toBeChecked()
  expect(readdirSync(join(docs(app.userData), 'Florestas Frias')).sort()).toEqual(['cenas', 'efeitos', 'mapas', 'musicas', 'objetos', 'tokens'])
  await expect(app.page.getByTestId('host')).toBeEnabled()
})

test('[C3] CAMP-03 a bad or existing campaign name shows the message and creates nothing', async () => {
  const app = await launch()
  for (const [name, msg] of [['', 'Nome inválido'], ['a/b', 'Nome inválido'], ['teste', 'Campanha já existe']]) {
    await app.page.getByTestId('new-campaign-name').fill(name)
    await app.page.getByTestId('new-campaign').click()
    await expect(app.page.getByTestId('home-error'), name).toHaveText(msg)
  }
  expect(readdirSync(docs(app.userData))).toEqual(['Teste'])
})

test('[C4] CAMP-04 "Hospedar" is disabled with no campaign selected', async () => {
  const app = await launch({ campaign: false })
  await expect(app.page.getByTestId('host')).toBeDisabled()
  mkdirSync(join(docs(app.userData), 'Avulsa'))
  await app.app.close()
  const again = await launch({ userData: app.userData })
  await expect(again.page.getByTestId('campaign-Avulsa')).toBeVisible()
  await expect(again.page.getByTestId('host')).toBeDisabled() // listed, but not chosen yet
  await again.page.getByTestId('campaign-Avulsa').click()
  await expect(again.page.getByTestId('host')).toBeEnabled()
})

test('[C5] CAMP-05 hosting creates the missing folders, remembers the campaign and shows its name in Mapas', async () => {
  const app = await launch({ campaign: false })
  mkdirSync(join(docs(app.userData), 'Feita à mão', 'mapas'), { recursive: true })
  await app.app.close()
  const again = await launch({ userData: app.userData })
  await again.page.getByTestId('campaign-Feita à mão').click()
  await host(again.page, await freePort())
  await expect(again.page.getByTestId('panel-mapas').getByTestId('campaign-name')).toHaveText('Feita à mão')
  expect(readdirSync(join(docs(app.userData), 'Feita à mão')).sort()).toEqual(['cenas', 'efeitos', 'mapas', 'musicas', 'objetos', 'tokens'])
})

test('[C6] CAMP-06 the last campaign comes selected next time, if its folder still exists', async () => {
  const app = await launch({ campaign: false })
  for (const n of ['Um', 'Dois']) mkdirSync(join(docs(app.userData), n))
  await app.app.close()
  const first = await launch({ userData: app.userData })
  await first.page.getByTestId('campaign-Dois').click()
  await host(first.page, await freePort())
  await first.app.close()
  const second = await launch({ userData: app.userData })
  await expect(second.page.getByTestId('campaign-Dois').locator('input')).toBeChecked()
  await second.app.close()
  rmSync(join(docs(app.userData), 'Dois'), { recursive: true })
  const third = await launch({ userData: app.userData })
  await expect(third.page.getByTestId('campaign-Um').locator('input')).not.toBeChecked()
  await expect(third.page.getByTestId('host')).toBeDisabled()
})

test('[C7] CAMP-07 "Abrir pasta" opens the campaign folder', async () => {
  const app = await launch()
  await host(app.page, await freePort())
  await showPanel(app.page, 'mapas')
  await app.page.getByTestId('open-folder').click()
  await expect.poll(() => app.app.evaluate(() => (globalThis as { __mesaOpened?: string }).__mesaOpened)).toBe(join(docs(app.userData), 'Teste'))
})
