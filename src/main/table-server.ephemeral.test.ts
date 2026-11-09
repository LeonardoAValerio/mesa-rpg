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
const sendE = (c: TestClient, e: unknown): void => c.send({ t: 'ephemeral', e })

describe('ephemeral relay', () => {
  it('[C63] TOOL-05 of 40 pings in 10 s only 30 are relayed', async () => {
    const { master, ana } = await start()
    for (let i = 0; i < 40; i++) sendE(ana, { type: 'ping', x: i, y: 0 })
    sendE(ana, { type: 'ruler', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }) // marks the end of the burst
    await master.next('ephemeral', (m) => m.e.type === 'ruler')
    const pings = master.msgs.filter((m) => m.t === 'ephemeral' && m.e.type === 'ping')
    expect(pings).toHaveLength(30)
    expect(pings.map((m) => (m.t === 'ephemeral' && m.e.type === 'ping' ? m.e.x : -1))).toEqual([...Array(30).keys()])
  })

  it('counts a stroke once, however many updates it gets', async () => {
    const { master, ana } = await start()
    for (let i = 0; i < 50; i++) sendE(ana, { type: 'stroke', strokeId: 's1', points: [{ x: 0, y: 0 }, { x: i, y: i }], done: i === 49 })
    await master.next('ephemeral', (m) => m.e.type === 'stroke' && m.e.done)
    expect(master.msgs.filter((m) => m.t === 'ephemeral')).toHaveLength(50)
  })

  it('[C50] PERM-08 a player with no tokens can roll, chat and send ruler, ping and stroke', async () => {
    const { master, ana } = await start()
    expect(Object.keys(ana.view().tokens)).toEqual([])
    ana.act('r', { type: 'roll', expr: '1d20' })
    await ana.next('ack', (m) => m.id === 'r')
    ana.act('c', { type: 'chat', text: 'oi' })
    await ana.next('ack', (m) => m.id === 'c')
    sendE(ana, { type: 'ruler', from: { x: 0, y: 0 }, to: { x: 300, y: 500 } })
    sendE(ana, { type: 'ping', x: 10, y: 20 })
    sendE(ana, { type: 'stroke', strokeId: 'a', points: [{ x: 1, y: 1 }, { x: 2, y: 2 }], done: true })
    await master.next('ephemeral', (m) => m.e.type === 'stroke')
    const got = master.msgs.filter((m) => m.t === 'ephemeral' || m.t === 'log').map((m) => (m.t === 'log' ? m.entry.kind : m.e.type))
    expect(got).toEqual(['roll', 'chat', 'ruler', 'ping', 'stroke'])
    expect(master.msgs.filter((m) => m.t === 'ephemeral').every((m) => m.t === 'ephemeral' && m.from === 'Ana')).toBe(true)
  })
})
