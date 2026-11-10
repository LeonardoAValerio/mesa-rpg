import { expect, test } from '@playwright/test'
import { closeAll, freePort, host, join, launch, masterAndPlayer, showPanel } from './helpers'

test.afterEach(closeAll)

test('[C1] NET-01 the app opens on the start screen with "Hospedar" and "Entrar"', async () => {
  const { page } = await launch()
  await expect(page.getByTestId('host')).toHaveText('Hospedar')
  await expect(page.getByTestId('join')).toHaveText('Entrar')
  await expect(page.getByTestId('table')).toHaveCount(0)
})

test('[C2] NET-02 "Hospedar" with the default port starts the server on 0.0.0.0:47800 and opens the table as master', async () => {
  const { app, page } = await launch()
  await expect(page.getByTestId('host-port')).toHaveValue('47800')
  await page.getByTestId('host').click()
  await expect(page.getByTestId('you')).toHaveText('Mestre · mestre')
  const bound = await app.evaluate(() => {
    const s = (globalThis as { __mesaServer?: { host: string; port: number } }).__mesaServer
    return s ? { host: s.host, port: s.port } : null
  })
  expect(bound).toEqual({ host: '0.0.0.0', port: 47800 })
})

test('[C3] NET-03 hosting lists 25.x as "Hamachi" and 26.x as "Radmin" and "Copiar" copies IP:porta', async () => {
  const port = await freePort()
  const { app, page } = await launch({ ifaces: ['25.1.2.3', '26.4.5.6', '192.168.0.5'] })
  await host(page, port)
  await showPanel(page, 'rede')
  const rows = page.getByTestId('address')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0).getByTestId('address-label')).toHaveText('Hamachi')
  await expect(rows.nth(0).getByTestId('address-ip')).toHaveText(`25.1.2.3:${port}`)
  await expect(rows.nth(1).getByTestId('address-label')).toHaveText('Radmin')
  await expect(rows.nth(1).getByTestId('address-ip')).toHaveText(`26.4.5.6:${port}`)
  await expect(rows.nth(2).getByTestId('address-label')).toHaveText('Rede')
  await rows.nth(0).getByTestId('copy').click()
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(`25.1.2.3:${port}`)
  await rows.nth(1).getByTestId('copy').click()
  await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.readText())).toBe(`26.4.5.6:${port}`)
})

test('"Hospedar" with port 80 shows "Porta inválida" and stays on the start screen (NET-04)', async () => {
  const { page } = await launch()
  await page.getByTestId('host-port').fill('80')
  await page.getByTestId('host').click()
  await expect(page.getByTestId('home-error')).toHaveText('Porta inválida')
  await expect(page.getByTestId('table')).toHaveCount(0)
})

test('"Hospedar" on a busy port shows "Porta <porta> em uso" on the start screen (NET-05)', async () => {
  const port = await freePort()
  const first = await launch()
  await host(first.page, port)
  const second = await launch()
  await second.page.getByTestId('host-port').fill(String(port))
  await second.page.getByTestId('host').click()
  await expect(second.page.getByTestId('home-error')).toHaveText(`Porta ${port} em uso`)
  await expect(second.page.getByTestId('host')).toBeVisible()
})

test('[C6] NET-06 joining 127.0.0.1 as "Ana" shows "Ana" in the players list of both windows', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await expect(master.page.getByTestId('player')).toHaveText(['Mestre', 'Ana'])
  await expect(player.page.getByTestId('player')).toHaveText(['Mestre', 'Ana'])
  await expect(player.page.getByTestId('you')).toHaveText('Ana · jogador')
})

test('joining a port with no table shows "Não foi possível conectar a <IP>:<porta>" and keeps the fields (NET-08)', async () => {
  const port = await freePort()
  const { page } = await launch()
  await page.getByTestId('join-ip').fill('127.0.0.1')
  await page.getByTestId('join-port').fill(String(port))
  await page.getByTestId('join-name').fill('Ana')
  await page.getByTestId('join').click()
  await expect(page.getByTestId('home-error')).toHaveText(`Não foi possível conectar a 127.0.0.1:${port}`)
  await expect(page.getByTestId('join-ip')).toHaveValue('127.0.0.1')
  await expect(page.getByTestId('join-port')).toHaveValue(String(port))
  await expect(page.getByTestId('join-name')).toHaveValue('Ana')
})

test('a name already in use shows "Nome já em uso" (NET-07)', async () => {
  const { port } = await masterAndPlayer('Ana')
  const other = await launch()
  await other.page.getByTestId('join-ip').fill('127.0.0.1')
  await other.page.getByTestId('join-port').fill(String(port))
  await other.page.getByTestId('join-name').fill('Ana')
  await other.page.getByTestId('join').click()
  await expect(other.page.getByTestId('home-error')).toHaveText('Nome já em uso')
})

test('[C13] NET-13 when the master closes the app the player sees "O mestre encerrou a mesa" and "Voltar ao início"', async () => {
  const { master, player } = await masterAndPlayer('Ana')
  await master.app.close()
  await expect(player.page.getByTestId('status-message')).toHaveText('O mestre encerrou a mesa')
  await player.page.getByTestId('back-home').click()
  await expect(player.page.getByTestId('host')).toBeVisible()
})

test('"Encerrar mesa" also tells the player "O mestre encerrou a mesa" (NET-13)', async () => {
  const port = await freePort()
  const master = await launch()
  await host(master.page, port)
  const player = await launch()
  await join(player.page, port, 'Bia')
  await master.page.getByTestId('stop-host').click()
  await expect(master.page.getByTestId('host')).toBeVisible()
  await expect(player.page.getByTestId('status-message')).toHaveText('O mestre encerrou a mesa')
})

test('[C12] NET-12 after 60 s without reconnecting the player sees "Conexão perdida" and "Voltar ao início", which goes home', async () => {
  test.setTimeout(150_000)
  const { master, player } = await masterAndPlayer('Ana')
  master.app.process().kill('SIGKILL') // the link dies with no goodbye, as when the VPN drops
  const t0 = Date.now()
  // NET-10: the screen while it retries
  await expect(player.page.getByTestId('status-message')).toHaveText('Conexão com o mestre perdida — tentando reconectar', { timeout: 15_000 })
  await expect(player.page.getByTestId('back-home')).toHaveCount(0)
  await expect(player.page.getByTestId('status-message')).toHaveText('Conexão perdida', { timeout: 90_000 })
  const elapsed = Date.now() - t0
  expect(elapsed).toBeGreaterThanOrEqual(59_000) // never before the 60 s of the spec (kill-to-detection takes under 1 s)
  expect(elapsed).toBeLessThan(75_000)
  await player.page.getByTestId('back-home').click()
  await expect(player.page.getByTestId('host')).toBeVisible()
  await expect(player.page.getByTestId('join')).toBeVisible()
})
