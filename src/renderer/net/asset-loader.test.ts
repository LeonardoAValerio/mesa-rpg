import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { AssetCache } from '../../main/asset-cache'
import { AssetStore, sha256 } from '../../main/asset-store'
import { startTableServer, type TableServer } from '../../main/table-server'
import { joinAs, type TestClient } from '../../main/testing'
import { AssetLoader, type AssetCachePort } from './asset-loader'

const img = (n: number): Uint8Array => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, n, n, n, n])

class MemCache implements AssetCachePort {
  items = new Map<string, Uint8Array>()
  async get(h: string): Promise<Uint8Array | null> {
    return this.items.get(h) ?? null
  }
  async put(h: string, b: Uint8Array): Promise<void> {
    this.items.set(h, b)
  }
}

let server: TableServer | null = null
const clients: TestClient[] = []
afterEach(async () => {
  for (const c of clients.splice(0)) c.close()
  await server?.close()
  server = null
})

/** A hosted table whose scene uses a map and one token image; returns the hashes. */
async function hosted(): Promise<{ base: string; map: string; token: string }> {
  const store = new AssetStore()
  const map = store.put(img(1))
  const token = store.put(img(2))
  server = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't', store })
  const master = await joinAs(server.port, 'Mestre', 't')
  clients.push(master)
  master.act('m', { type: 'map/set', hash: map, width: 800, height: 600, grid: { cell: 100 } })
  master.act('p', { type: 'token/place', hash: token, name: 'goblin', kind: 'character', x: 150, y: 150, width: 1, ring: 'inimigo' })
  await master.next('ack', (m) => m.id === 'p')
  return { base: `http://127.0.0.1:${server.port}`, map, token }
}

function counting(): { fetch: typeof fetch; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    fetch: (async (url: string) => {
      calls.push(url)
      return fetch(url)
    }) as typeof fetch
  }
}

const nodeSha = async (b: Uint8Array): Promise<string> => sha256(b)

describe('AssetLoader', () => {
  it('[C38] ASSET-02 with an empty cache it downloads the scene hash and writes it to the cache', async () => {
    const { base, map } = await hosted()
    const cache = new MemCache()
    const f = counting()
    const got = await new AssetLoader({ baseUrl: base, fetch: f.fetch, cache, sha256: nodeSha }).ensure([map])
    expect(got.get(map)).toEqual(img(1))
    expect(cache.items.get(map)).toEqual(img(1))
    expect(f.calls).toEqual([`${base}/asset/${map}`])
  })

  it('[C39] ASSET-03 with the hash already cached it makes no request', async () => {
    const { base, map, token } = await hosted()
    const cache = new MemCache()
    cache.items.set(map, img(1))
    cache.items.set(token, img(2))
    const f = counting()
    const got = await new AssetLoader({ baseUrl: base, fetch: f.fetch, cache, sha256: nodeSha }).ensure([map, token])
    expect(f.calls).toEqual([])
    expect(got.get(token)).toEqual(img(2))
  })

  it('[C40] ASSET-04 shows "Baixando arquivos 1/2", then "Baixando arquivos 2/2", then clears', async () => {
    const { base, map, token } = await hosted()
    const loader = new AssetLoader({ baseUrl: base, fetch, cache: new MemCache(), sha256: nodeSha })
    const seen: Array<string | null> = []
    loader.onStatus((s) => seen.push(s))
    await loader.ensure([map, token])
    expect(seen).toEqual(['Baixando arquivos 1/2', 'Baixando arquivos 2/2', null])
  })

  it('[C41] ASSET-05 a file with the wrong hash is asked 3 times and then shows "Falha ao baixar arquivo"', async () => {
    const { base, map } = await hosted()
    const calls: string[] = []
    const corrupt = (async (url: string) => {
      calls.push(url)
      return new Response(new Uint8Array([1, 2, 3]))
    }) as typeof fetch
    const cache = new MemCache()
    const loader = new AssetLoader({ baseUrl: base, fetch: corrupt, cache, sha256: nodeSha })
    const got = await loader.ensure([map])
    expect(calls).toHaveLength(3)
    expect(got.has(map)).toBe(false)
    expect(cache.items.has(map)).toBe(false)
    expect(loader.status).toBe('Falha ao baixar arquivo')
  })

  it('a file that is wrong once and right the second time is kept', async () => {
    const { base, map } = await hosted()
    let n = 0
    const flaky = (async (url: string) => (++n === 1 ? new Response(new Uint8Array([9])) : fetch(url))) as typeof fetch
    const got = await new AssetLoader({ baseUrl: base, fetch: flaky, cache: new MemCache(), sha256: nodeSha }).ensure([map])
    expect(n).toBe(2)
    expect(got.get(map)).toEqual(img(1))
  })
})

describe('AssetCache', () => {
  it('keeps files under their hash and refuses bytes that do not match the hash', async () => {
    const cache = new AssetCache(join(mkdtempSync(join(tmpdir(), 'mesa-cache-')), 'cache'))
    const h = sha256(img(5))
    expect(await cache.get(h)).toBeNull()
    expect(await cache.put(h, img(6))).toBe(false)
    expect(await cache.get(h)).toBeNull()
    expect(await cache.put(h, img(5))).toBe(true)
    expect(await cache.get(h)).toEqual(img(5))
  })
})
