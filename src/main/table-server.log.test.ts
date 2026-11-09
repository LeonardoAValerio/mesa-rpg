import { afterEach, describe, expect, it } from 'vitest'
import { startTableServer, type TableServer } from './table-server'
import { joinAs, type TestClient } from './testing'

let server: TableServer | null = null
const clients: TestClient[] = []
afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})
async function start(): Promise<{ master: TestClient; ana: TestClient }> {
  server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't' })
  const master = await joinAs(server.port, 'Mestre', 't')
  const ana = await joinAs(server.port, 'Ana')
  clients.push(master, ana)
  return { master, ana }
}

describe('shared log', () => {
  it('[C51] DICE-01 rolling `1d8+1d6-2` logs the author, the expression, each die and the right total for everyone', async () => {
    const { master, ana } = await start()
    ana.act('r', { type: 'roll', expr: '1d8+1d6-2' })
    await ana.next('ack', (m) => m.id === 'r')
    for (const c of [ana, master]) {
      const { entry } = await c.next('log')
      expect(entry).toMatchObject({ author: 'Ana', kind: 'roll', text: '1d8+1d6-2' })
      const [d8, d6, k] = entry.roll!.terms
      expect(d8).toMatchObject({ kind: 'dice', sides: 8, sign: 1 })
      expect(d6).toMatchObject({ kind: 'dice', sides: 6, sign: 1 })
      expect(k).toMatchObject({ kind: 'const', sign: -1, value: 2 })
      expect(d8.rolls).toHaveLength(1)
      expect(d8.rolls![0]).toBeGreaterThanOrEqual(1)
      expect(d8.rolls![0]).toBeLessThanOrEqual(8)
      expect(d6.rolls![0]).toBeGreaterThanOrEqual(1)
      expect(d6.rolls![0]).toBeLessThanOrEqual(6)
      expect(entry.roll!.total).toBe(d8.rolls![0] + d6.rolls![0] - 2)
    }
  })

  it('[C54] DICE-04 `2d`, `101d6`, `1d1`, `1d6+2000` and `2d6kh3` give "Notação inválida: <expressão>" and nothing reaches the log', async () => {
    const { master, ana } = await start()
    for (const expr of ['2d', '101d6', '1d1', '1d6+2000', '2d6kh3', '1d6+1000+1000']) {
      ana.act(expr, { type: 'roll', expr })
      expect((await ana.next('reject', (m) => m.id === expr)).reason).toBe(`Notação inválida: ${expr}`)
    }
    const late = await joinAs(server!.port, 'Bia')
    clients.push(late)
    expect(late.msgs.find((m) => m.t === 'welcome')).toMatchObject({ log: [] })
    expect([...master.msgs, ...ana.msgs].some((m) => m.t === 'log')).toBe(false)
  })

  it('[C56] CHAT-02 an empty message or one of 501 characters is not sent; 500 characters are', async () => {
    const { ana } = await start()
    ana.act('e', { type: 'chat', text: '   ' })
    await ana.next('reject', (m) => m.id === 'e')
    ana.act('l', { type: 'chat', text: 'x'.repeat(501) })
    await ana.next('reject', (m) => m.id === 'l')
    ana.act('ok', { type: 'chat', text: 'y'.repeat(500) })
    await ana.next('ack', (m) => m.id === 'ok')
    ana.act('emoji', { type: 'chat', text: 'z'.repeat(499) + '🐉' }) // 500 characters
    await ana.next('ack', (m) => m.id === 'emoji')
    ana.act('emoji2', { type: 'chat', text: 'z'.repeat(500) + '🐉' }) // 501 characters
    await ana.next('reject', (m) => m.id === 'emoji2')
    const logs = ana.msgs.filter((m) => m.t === 'log')
    expect(logs).toHaveLength(2)
    expect(logs[0]).toMatchObject({ entry: { kind: 'chat', author: 'Ana', text: 'y'.repeat(500) } })
  })

  it('[C57] CHAT-03 with 250 entries in the log, whoever joins gets the last 200', async () => {
    const { ana } = await start()
    for (let i = 1; i <= 250; i++) ana.act(`c${i}`, { type: 'chat', text: `msg ${i}` })
    await ana.next('ack', (m) => m.id === 'c250', 5000)
    const late = await joinAs(server!.port, 'Bia')
    clients.push(late)
    const welcome = late.msgs.find((m) => m.t === 'welcome')
    if (welcome?.t !== 'welcome') throw new Error('no welcome')
    expect(welcome.log).toHaveLength(200)
    expect(welcome.log[0].text).toBe('msg 51')
    expect(welcome.log[199].text).toBe('msg 250')
  })
})
