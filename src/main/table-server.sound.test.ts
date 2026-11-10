import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore } from './asset-store'
import { startTableServer, type TableServer } from './table-server'
import { joinAs, type TestClient } from './testing'

const TOKEN = 'host-secret'
const wav = (n: number): Uint8Array => new Uint8Array([...'RIFF'].map((c) => c.charCodeAt(0)).concat([n, 0, 0, 0], [...'WAVEfmt '].map((c) => c.charCodeAt(0))))
let server: TableServer | null = null
const clients: TestClient[] = []
afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})
async function table(): Promise<{ store: AssetStore; master: TestClient; ana: TestClient; rain: string; sword: string }> {
  const store = new AssetStore()
  const rain = store.put(wav(1))
  const sword = store.put(wav(2))
  server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: TOKEN, store })
  server.setEffects([sword])
  const master = await joinAs(server.port, 'Mestre', TOKEN)
  const ana = await joinAs(server.port, 'Ana')
  clients.push(master, ana)
  return { store, master, ana, rain, sword }
}

describe('sound on the table server', () => {
  it('[C17] SOM-17 every window gets the campaign\'s effects on join, and later changes, and can download them', async () => {
    const { ana, sword } = await table()
    expect((await ana.next('effects')).hashes).toEqual([sword])
    const res = await fetch(`http://127.0.0.1:${server!.port}/asset/${sword}`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('audio/wav')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(wav(2))
    server!.setEffects([])
    expect((await ana.next('effects')).hashes).toEqual([])
    expect((await fetch(`http://127.0.0.1:${server!.port}/asset/${sword}`)).status).toBe(404) // no longer the campaign's
  })

  it('SOM-16 an effect played by the master reaches master and player with the server time', async () => {
    const { master, ana, sword } = await table()
    const before = Date.now()
    master.act('e', { type: 'sound/effect', hash: sword })
    for (const c of [master, ana]) {
      const e = await c.next('effect')
      expect(e.hash).toBe(sword)
      expect(e.at).toBeGreaterThanOrEqual(before)
      expect(e.at).toBeLessThanOrEqual(Date.now())
    }
  })

  it('SOM-06, SOM-14 a layer turned on is in every view and its file is served', async () => {
    const { master, ana, rain } = await table()
    expect((await fetch(`http://127.0.0.1:${server!.port}/asset/${rain}`)).status).toBe(404) // not playing, not an effect
    master.act('t', { type: 'sound/toggle', hash: rain })
    await master.next('ack', (m) => m.id === 't')
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'sound'))
    expect(ana.view().sound.layers.map((l) => [l.hash, l.volume, l.stoppingAt])).toEqual([[rain, 100, null]])
    expect((await fetch(`http://127.0.0.1:${server!.port}/asset/${rain}`)).status).toBe(200)
  })

  it('SOM-07 a layer turned off leaves every view about 2 s later', async () => {
    const { master, ana, rain } = await table()
    master.act('on', { type: 'sound/toggle', hash: rain })
    await master.next('ack', (m) => m.id === 'on')
    master.act('off', { type: 'sound/toggle', hash: rain })
    await master.next('ack', (m) => m.id === 'off')
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'sound' && o.sound.layers[0]?.stoppingAt !== null))
    await ana.next('patch', (m) => m.ops.some((o) => o.op === 'sound' && o.sound.layers.length === 0), 3000)
    expect(ana.view().sound.layers).toEqual([])
  })

  it('welcome and patches carry the master\'s clock', async () => {
    const { master, ana, rain } = await table()
    const w = ana.msgs.find((m) => m.t === 'welcome')!
    expect(w.t === 'welcome' && Math.abs(w.serverNow - Date.now())).toBeLessThan(2000)
    master.act('t', { type: 'sound/toggle', hash: rain })
    const p = await ana.next('patch', (m) => m.ops.some((o) => o.op === 'sound'))
    expect(Math.abs(p.serverNow - Date.now())).toBeLessThan(2000)
  })

  it('SOM-19 a player\'s sound actions are refused with "Sem permissão" and change nothing; an unknown file is refused for the master', async () => {
    const { master, ana, rain, sword } = await table()
    ana.act('a', { type: 'sound/toggle', hash: rain })
    expect((await ana.next('reject', (m) => m.id === 'a')).reason).toBe('Sem permissão')
    ana.act('b', { type: 'sound/effect', hash: sword })
    expect((await ana.next('reject', (m) => m.id === 'b')).reason).toBe('Sem permissão')
    expect(master.msgs.some((m) => m.t === 'effect')).toBe(false)
    expect(server!.getSound().layers).toEqual([])
    master.act('u', { type: 'sound/toggle', hash: 'f'.repeat(64) })
    expect((await master.next('reject', (m) => m.id === 'u')).reason).toBe('Arquivo desconhecido')
  })
})
