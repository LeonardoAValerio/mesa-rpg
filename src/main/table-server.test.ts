import { createServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { startTableServer, type TableServer } from './table-server'
import { connectClient, joinAs, type TestClient } from './testing'

const TOKEN = 'host-secret'
let server: TableServer | null = null
const clients: TestClient[] = []

async function start(): Promise<TableServer> {
  server = await startTableServer({ port: 0, hostToken: TOKEN })
  return server
}
async function join(name: string, token?: string): Promise<TestClient> {
  const c = await joinAs(server!.port, name, token)
  clients.push(c)
  return c
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})

describe('TableServer connection', () => {
  it('listens on 0.0.0.0 and gives the hostToken holder the master role (NET-02)', async () => {
    const s = await start()
    expect(s.host).toBe('0.0.0.0')
    const master = await connectClient(s.port)
    clients.push(master)
    master.send({ t: 'join', name: 'qualquer', hostToken: TOKEN })
    const w = await master.next('welcome')
    expect(w.you).toEqual({ role: 'master', name: 'Mestre' })
  })

  it('[C5] NET-05 fails to start on a busy port with "Porta <porta> em uso"', async () => {
    const blocker = createServer()
    await new Promise<void>((r) => blocker.listen(0, '0.0.0.0', () => r()))
    const port = (blocker.address() as { port: number }).port
    await expect(startTableServer({ port, hostToken: TOKEN })).rejects.toThrow(`Porta ${port} em uso`)
    await new Promise<void>((r) => blocker.close(() => r()))
  })

  it('[C7] NET-07 rejects an empty name, a 25-character name and a name in use, with the matching reason', async () => {
    const s = await start()
    await join('Ana')
    for (const [name, reason] of [
      ['', 'Nome inválido'],
      ['x'.repeat(25), 'Nome inválido'],
      ['Ana', 'Nome já em uso'],
      ['Mestre', 'Nome já em uso']
    ] as const) {
      const c = await connectClient(s.port)
      clients.push(c)
      c.send({ t: 'join', name })
      expect((await c.next('join-error')).reason).toBe(reason)
      await c.closed
    }
    expect(s.players()).toEqual(['Ana'])
  })

  it('[C9] NET-09 refuses a ninth player with "Mesa cheia"', async () => {
    const s = await start()
    await join('Mestre', TOKEN)
    for (let i = 1; i <= 8; i++) await join(`P${i}`)
    const ninth = await connectClient(s.port)
    clients.push(ninth)
    ninth.send({ t: 'join', name: 'P9' })
    expect((await ninth.next('join-error')).reason).toBe('Mesa cheia')
    expect(s.players()).toHaveLength(9)
  })

  it('[C15] NET-15 drops invalid JSON and unknown actions and keeps serving', async () => {
    const s = await start()
    const ana = await join('Ana')
    ana.sendRaw('{isto não é json')
    ana.send({ t: 'action', id: '1', action: { type: 'token/teleport', id: 'x' } })
    ana.send({ t: 'nada' })
    const sceneBefore = JSON.stringify(s.getScene())
    const bia = await join('Bia')
    const patch = await ana.next('patch', (m) => m.ops.some((o) => o.op === 'players'))
    expect(patch.ops).toEqual([{ op: 'players', players: ['Ana', 'Bia'] }])
    expect(bia.msgs[0]).toMatchObject({ t: 'welcome', you: { role: 'player', name: 'Bia' } })
    expect(JSON.stringify(s.getScene())).toBe(sceneBefore)
    expect(ana.msgs.some((m) => m.t === 'reject')).toBe(false)
  })

  it('sends the players list to everyone when someone joins or leaves (NET-06)', async () => {
    await start()
    const ana = await join('Ana')
    const bia = await join('Bia')
    expect((await ana.next('patch')).ops).toEqual([{ op: 'players', players: ['Ana', 'Bia'] }])
    bia.close()
    expect((await ana.next('patch')).ops).toEqual([{ op: 'players', players: ['Ana'] }])
  })

  it('sends {t:"closed"} to every client when the master closes the table (NET-13)', async () => {
    const s = await start()
    const ana = await join('Ana')
    await s.close()
    server = null
    await ana.closed
    expect(ana.msgs.at(-1)).toEqual({ t: 'closed' })
  })
})
