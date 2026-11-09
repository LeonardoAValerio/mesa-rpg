import type { View } from '../../core/types'
import { AssetLoader, webSha256 } from '../net/asset-loader'
import type { TableClient } from '../net/table-client'
import { h } from '../ui/dom'
import { decodeImage, type TextureStore } from './textures'

/** Keeps the texture store filled with every image the view (and the master's library) uses. */
export function syncAssets(client: TableClient, textures: TextureStore, statusHost: HTMLElement): () => void {
  const loader = new AssetLoader({
    baseUrl: client.httpBase,
    fetch: (...a) => fetch(...a),
    cache: { get: (hash) => window.mesa.cacheGet(hash), put: (hash, bytes) => window.mesa.cachePut(hash, bytes) },
    sha256: webSha256
  })
  const status = h('div', { class: 'asset-status', testid: 'asset-status', hidden: true })
  statusHost.append(status)
  const offStatus = loader.onStatus((s) => {
    status.textContent = s ?? ''
    status.hidden = !s
  })
  const wanted = (v: View | null): string[] => {
    const hs = new Set<string>()
    if (v?.map) hs.add(v.map.hash)
    for (const t of Object.values(v?.tokens ?? {})) hs.add(t.hash)
    for (const l of client.library) hs.add(l.hash)
    return [...hs].filter((x) => !textures.has(x))
  }
  const pending = new Set<string>()
  const refresh = (): void => {
    const need = wanted(client.view).filter((x) => !pending.has(x))
    if (!need.length) return
    for (const x of need) pending.add(x)
    void loader.ensure(need).then(async (got) => {
      for (const [hash, bytes] of got) {
        const bmp = await decodeImage(bytes)
        if (bmp) textures.add(hash, bmp)
      }
      for (const x of need) pending.delete(x)
    })
  }
  const offView = client.on('view', refresh)
  const offLib = client.on('library', refresh)
  refresh()
  return () => {
    offStatus()
    offView()
    offLib()
    status.remove()
  }
}
