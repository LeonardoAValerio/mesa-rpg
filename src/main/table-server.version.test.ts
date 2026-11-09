import { afterEach, describe, expect, it } from 'vitest'
import { startTableServer, type TableServer } from './table-server'
import { connectClient, type TestClient } from './testing'

const TOKEN = 'host-secret'
const VERSION = '0.2.0'
let server: TableServer | null = null
const clients: TestClient[] = []

async function start(): Promise<TableServer> {
  server = await startTableServer({ port: 0, hostToken: TOKEN, version: VERSION })
  return server
}
async function open(): Promise<TestClient> {
  const c = await connectClient(server!.port)
  clients.push(c)
  return c
}

afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})

describe('TableServer version check', () => {
  it('[C16] VER-02 refuses a join with no version, naming the player version "desconhecida", and keeps no session', async () => {
    const s = await start()
    const master = await open()
    master.send({ t: 'join', name: 'Mestre', hostToken: TOKEN, version: VERSION })
    await master.next('welcome')

    const old = await open()
    old.send({ t: 'join', name: 'Ana' }) // what the 0.1.0 app sends
    expect((await old.next('join-error')).reason).toBe(
      'Versão diferente da do mestre: mestre 0.2.0, você desconhecida. Atualize o app.'
    )
    await old.closed
    expect(old.msgs.some((m) => m.t === 'welcome')).toBe(false)
    expect(s.players()).toEqual(['Mestre'])
    expect(master.view().players).toEqual(['Mestre'])
  })

  it('VER-01 VER-05 refuses a join with another version with both versions, before the name rules, and keeps no session', async () => {
    const s = await start()
    const master = await open()
    master.send({ t: 'join', name: 'Mestre', hostToken: TOKEN, version: VERSION })
    await master.next('welcome')

    for (const [name, version] of [
      ['Ana', '0.1.9'],
      ['', '0.2.1'] // an invalid name still gets the version message: the version is checked first
    ] as const) {
      const c = await open()
      c.send({ t: 'join', name, version })
      expect((await c.next('join-error')).reason).toBe(
        `Versão diferente da do mestre: mestre 0.2.0, você ${version}. Atualize o app.`
      )
      await c.closed
    }
    expect(s.players()).toEqual(['Mestre'])
    expect(master.view().players).toEqual(['Mestre'])
  })

  it('[C18] VER-04 a join with the same version gets welcome carrying the master version and joins the table', async () => {
    const s = await start()
    const master = await open()
    master.send({ t: 'join', name: 'Mestre', hostToken: TOKEN, version: VERSION })
    expect((await master.next('welcome')).version).toBe(VERSION)

    const ana = await open()
    ana.send({ t: 'join', name: 'Ana', version: VERSION })
    const w = await ana.next('welcome')
    expect(w.version).toBe(VERSION)
    expect(w.you).toEqual({ role: 'player', name: 'Ana' })
    expect(s.players()).toEqual(['Mestre', 'Ana'])
  })
})
