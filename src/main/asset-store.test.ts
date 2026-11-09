import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetStore } from './asset-store'
import { startTableServer, type TableServer } from './table-server'
import { joinAs, type TestClient } from './testing'

const png = (n: number): Uint8Array => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n])

describe('AssetStore', () => {
  it('[C37] ASSET-01 the same content gets the same SHA-256 hash and different content a different one', () => {
    const store = new AssetStore()
    const a = store.put(png(1))
    expect(a).toBe(createHash('sha256').update(png(1)).digest('hex'))
    expect(store.put(new Uint8Array(png(1)))).toBe(a)
    const b = store.put(png(2))
    expect(b).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(store.get(a)).toEqual(png(1))
  })
})

describe('GET /asset/:hash', () => {
  let server: TableServer | null = null
  const clients: TestClient[] = []
  afterEach(async () => {
    for (const c of clients.splice(0)) c.close()
    await server?.close()
    server = null
  })

  it('[C42] ASSET-06 answers 404 for a hash outside the scene and the library, and serves one the scene uses', async () => {
    const store = new AssetStore()
    const mapHash = store.put(png(1))
    const secret = store.put(png(9)) // stored, but never put on the table
    const libHash = store.put(png(3))
    server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't', store })
    const base = `http://127.0.0.1:${server.port}/asset/`
    const master = await joinAs(server.port, 'Mestre', 't')
    clients.push(master)

    expect((await fetch(base + mapHash)).status).toBe(404) // not referenced yet
    master.act('m', { type: 'map/set', hash: mapHash, width: 10, height: 10 })
    await master.next('ack', (m) => m.id === 'm')
    const ok = await fetch(base + mapHash)
    expect(ok.status).toBe(200)
    expect(new Uint8Array(await ok.arrayBuffer())).toEqual(png(1))

    expect((await fetch(base + secret)).status).toBe(404)
    expect((await fetch(base + '0'.repeat(64))).status).toBe(404)
    expect((await fetch(base + '..%2F..%2Fetc%2Fpasswd')).status).toBe(404)
    expect((await fetch(`http://127.0.0.1:${server.port}/`)).status).toBe(404)

    server.addLibrary([{ hash: libHash, name: 'goblin', faction: 'inimigo', size: 1 }])
    expect((await fetch(base + libHash)).status).toBe(200)
  })

  it('sends the library to the master only', async () => {
    const store = new AssetStore()
    const lib = store.put(png(4))
    server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't', store })
    const master = await joinAs(server.port, 'Mestre', 't')
    const ana = await joinAs(server.port, 'Ana')
    clients.push(master, ana)
    server.addLibrary([{ hash: lib, name: 'goblin', faction: 'inimigo', size: 2 }])
    expect((await master.next('library', (m) => m.items.length === 1)).items).toEqual([{ hash: lib, name: 'goblin', faction: 'inimigo', size: 2 }])
    await new Promise((r) => setTimeout(r, 50))
    expect(ana.msgs.some((m) => m.t === 'library')).toBe(false)
  })

  it('refuses a map or token whose image the master never imported', async () => {
    server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't' })
    const master = await joinAs(server.port, 'Mestre', 't')
    clients.push(master)
    master.act('m', { type: 'map/set', hash: 'e'.repeat(64), width: 10, height: 10 })
    expect((await master.next('reject', (m) => m.id === 'm')).reason).toBe('Arquivo desconhecido')
  })
})
