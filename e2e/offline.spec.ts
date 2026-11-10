import { expect, test } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, closeAll, freePort, host, join as joinTable, launch, putAsset, snap, solidPng, showPanel } from './helpers'

test.afterEach(closeAll)

const out = join(__dirname, '..', 'out', 'renderer')
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : [join(d, e.name)]))

test("[C78] PKG-02 the build loads nothing from an external http(s) URL and the CSP only allows 'self', ws: and http:", async () => {
  // 1. the CSP shipped in the built page
  const html = readFileSync(join(out, 'index.html'), 'utf8')
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1]
  expect(csp).toBe("default-src 'self'; connect-src 'self' ws: http:")
  // 2. no markup or stylesheet points at an external resource
  for (const f of files(out).filter((p) => /\.(html|css)$/.test(p))) {
    expect(readFileSync(f, 'utf8'), f).not.toMatch(/(src|href)\s*=\s*["']?https?:\/\/|url\(\s*["']?https?:\/\//i)
  }
  // 3. a whole session (host, join, map, token, roll) asks for nothing outside this PC
  const master = await launch()
  const player = await launch()
  const external: string[] = []
  const cspErrors: string[] = []
  for (const page of [master.page, player.page]) {
    page.on('console', (m) => /Content Security Policy/i.test(m.text()) && cspErrors.push(m.text()))
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (!['file:', 'data:', 'blob:'].includes(u.protocol) && !['127.0.0.1', 'localhost'].includes(u.hostname)) external.push(r.url())
    })
  }
  const port = await freePort()
  await host(master.page, port) // listeners are on before the table and the board start
  await joinTable(player.page, port, 'Ana')
  const map = await putAsset(master.app, solidPng(800, 600))
  await act(master.page, { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100 } })
  await act(master.page, { type: 'fog/coverAll' })
  await expect.poll(async () => (await snap(player.page)).map?.textured, { timeout: 10000 }).toBe(true)
  await player.page.getByTestId('dice-input').fill('1d20')
  await player.page.getByTestId('dice-roll').click()
  await showPanel(master.page, 'dados')
  await expect(master.page.getByTestId('log-entry')).toHaveCount(1)
  expect(external).toEqual([])
  expect(cspErrors).toEqual([])
})
