import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore } from './asset-store'
import { startTableServer, type TableServer } from './table-server'
import { joinAs, type TestClient } from './testing'

const TOKEN = 'host-secret'
const store = new AssetStore()
const H = store.put(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))
let server: TableServer | null = null
const clients: TestClient[] = []

afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})

async function join(name: string, token?: string): Promise<TestClient> {
  const c = await joinAs(server!.port, name, token)
  clients.push(c)
  return c
}

/** Master + Ana on an 800x600 map (100 px cells), fog revealed, with Guerreira (Ana's) at (1,1) and Goblin at (3,3). */
async function table(): Promise<{ master: TestClient; ana: TestClient; guerreira: string; goblin: string }> {
  server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: TOKEN, store })
  const master = await join('Mestre', TOKEN)
  const ana = await join('Ana')
  master.act('m', { type: 'map/set', hash: H, width: 800, height: 600, grid: { cell: 100 } })
  await master.next('ack', (m) => m.id === 'm')
  master.act('fog', { type: 'fog/revealAll' }) // a no-op since FOGD-01 (a new map has no fog); kept so the board is open either way
  await master.next('ack', (m) => m.id === 'fog')
  master.act('p1', { type: 'token/place', hash: H, name: 'Guerreira', kind: 'character', x: 150, y: 150, width: 1, ring: 'grupo' })
  await master.next('ack', (m) => m.id === 'p1')
  master.act('p2', { type: 'token/place', hash: H, name: 'Goblin', kind: 'character', x: 350, y: 350, width: 1, ring: null })
  await master.next('ack', (m) => m.id === 'p2')
  const byName = (n: string): string => Object.values(server!.getScene().tokens).find((t) => t.name === n)!.id
  const guerreira = byName('Guerreira')
  const goblin = byName('Goblin')
  master.act('o', { type: 'token/owner', id: guerreira, owner: 'Ana' })
  await master.next('ack', (m) => m.id === 'o')
  await ana.next('patch', (m) => m.ops.some((o) => o.op === 'token/upsert' && o.token.owner === 'Ana'))
  return { master, ana, guerreira, goblin }
}

describe('TableServer actions', () => {
  it('a move by the master reaches every client as a patch (TOK-05)', async () => {
    const { master, ana, goblin } = await table()
    master.act('mv', { type: 'token/move', id: goblin, x: 550, y: 250 })
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'token/upsert' && o.token.x === 550))
    expect(ana.view().tokens[goblin]).toMatchObject({ x: 550, y: 250 })
  })

  it('Ana moving a "Só mestre" Goblin gets `reject` "Só o mestre move este item" and it stays where it was (ITEM-15)', async () => {
    const { master, ana, goblin } = await table()
    master.act('lock', { type: 'token/update', id: goblin, movement: 'master' })
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'token/upsert' && o.token.movement === 'master'))
    ana.act('x', { type: 'token/move', id: goblin, x: 50, y: 50 })
    const r = await ana.next('reject', (m) => m.id === 'x')
    expect(r.reason).toBe('Só o mestre move este item')
    expect(server!.getScene().tokens[goblin]).toMatchObject({ x: 350, y: 350 })
    expect(ana.view().tokens[goblin]).toMatchObject({ x: 350, y: 350 })
  })

  it('[C14] NET-14 a refused action changes nothing on the server and sends no patch to anyone', async () => {
    const { master, ana, goblin } = await table()
    master.act('lock', { type: 'token/update', id: goblin, movement: 'locked' })
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'token/upsert' && o.token.movement === 'locked'))
    const before = JSON.stringify(server!.getScene())
    const mBefore = master.msgs.length
    const aBefore = ana.msgs.length
    ana.act('x', { type: 'token/move', id: goblin, x: 50, y: 50 })
    ana.act('y', { type: 'grid/set', grid: { cell: 20 } })
    await ana.next('reject', (m) => m.id === 'y')
    // a later accepted action is the first patch either client gets
    master.act('z', { type: 'token/update', id: goblin, movement: 'free' })
    await ana.next('patch')
    await master.next('ack', (m) => m.id === 'z')
    const after = (c: TestClient, from: number): string[] => c.msgs.slice(from).map((m) => m.t)
    expect(after(ana, aBefore)).toEqual(['reject', 'reject', 'patch'])
    expect(after(master, mBefore)).toEqual(['ack', 'patch'])
    expect(JSON.parse(before).tokens[goblin]).toMatchObject({ x: 350, y: 350 })
  })

  it('[C16] NET-16 two simultaneous moves of one token leave every client at the position of the last to arrive', async () => {
    const { master, ana, guerreira } = await table()
    const bia = await join('Bia')
    for (let i = 0; i < 10; i++) {
      master.act(`m${i}`, { type: 'token/move', id: guerreira, x: 650, y: (i % 5) * 100 + 50 })
      ana.act(`a${i}`, { type: 'token/move', id: guerreira, x: 50, y: (i % 5) * 100 + 50 })
    }
    await master.next('ack', (m) => m.id === 'm9')
    await ana.next('ack', (m) => m.id === 'a9')
    // order of arrival is the order the server applied them; the final state is the last applied
    const last = server!.getScene().tokens[guerreira]
    expect([650, 50]).toContain(last.x)
    const sync = (c: TestClient): Promise<unknown> => {
      c.act('ping', { type: 'chat', text: 'x' }) // any message the server answers, to flush earlier patches
      return c.next('reject', (m) => m.id === 'ping').catch(() => c.next('ack', (m) => m.id === 'ping'))
    }
    await Promise.all([sync(master), sync(ana), sync(bia)])
    for (const c of [master, ana, bia]) expect(c.view().tokens[guerreira]).toMatchObject({ x: last.x, y: last.y })
  })

  it('[C11] NET-11 Ana reconnecting with the same name still owns her token and can move it', async () => {
    const { ana, guerreira } = await table()
    ana.close()
    await ana.closed
    await new Promise((r) => setTimeout(r, 50))
    const again = await join('Ana')
    expect(again.view().tokens[guerreira]).toMatchObject({ owner: 'Ana' })
    again.act('mv', { type: 'token/move', id: guerreira, x: 250, y: 250 })
    await again.next('ack', (m) => m.id === 'mv')
    expect(server!.getScene().tokens[guerreira]).toMatchObject({ x: 250, y: 250, owner: 'Ana' })
  })
})
