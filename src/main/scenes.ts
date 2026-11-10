import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decodeCena, encodeCena, freeName, nameError, remapHashes, SCENE_EXISTS } from '../core/campaign'
import { imageInfo } from '../core/image-info'
import { sceneHashes } from '../core/mesa-file'
import type { Scene } from '../core/types'
import type { AssetStore } from './asset-store'
import type { CampaignFolder } from './campaign'
import { readImageFile } from './import'

export const MISSING_FILE = (path: string): string => `Arquivo não encontrado: ${path}`
const EXT = '.cena'

export type SaveResult = { ok: true } | { ok: false; exists: true } | { ok: false; error: string }

/** CAMP-16..22: the campaign's scenes, light files in `cenas/` that point at the campaign's images. */
export class CampaignScenes {
  constructor(private readonly folder: CampaignFolder, private readonly store: AssetStore) {}

  private dir(): string | null {
    const d = this.folder.dir()
    return d ? join(d, 'cenas') : null
  }

  /** CAMP-18: the scene names, sorted. */
  async list(): Promise<string[]> {
    const d = this.dir()
    if (!d) return []
    const files = await readdir(d).catch(() => [])
    return files.filter((f) => f.toLowerCase().endsWith(EXT)).map((f) => f.slice(0, -EXT.length)).sort((a, b) => a.localeCompare(b))
  }

  /**
   * CAMP-16, CAMP-17, CAMP-22: writes `cenas/<name>.cena`; an existing name needs `replace`; an image that is not in the
   * campaign (from an imported .mesa) is copied into `mapas/importados/` or `tokens/importados/` first.
   */
  async save(name: string, scene: Scene, replace: boolean): Promise<SaveResult> {
    const d = this.dir()
    if (!d) return { ok: false, error: 'Nenhuma campanha aberta' }
    const existing = await this.list()
    const error = nameError(name, existing, SCENE_EXISTS)
    if (error === SCENE_EXISTS && !replace) return { ok: false, exists: true }
    if (error && error !== SCENE_EXISTS) return { ok: false, error }
    const taken = existing.find((e) => e.toLocaleLowerCase() === name.toLocaleLowerCase())
    let copied = false
    for (const h of sceneHashes(scene)) {
      if (this.folder.pathOf(h)) continue
      const bytes = this.store.get(h)
      if (!bytes) return { ok: false, error: `Imagem da cena indisponível: ${h.slice(0, 8)}` }
      const info = imageInfo(bytes)
      const ext = info?.type === 'jpeg' ? 'jpg' : (info?.type ?? 'png')
      const section = scene.map?.hash === h ? 'mapas' : 'tokens'
      const target = join(this.folder.dir()!, section, 'importados')
      await mkdir(target, { recursive: true })
      const file = freeName(`importado-${h.slice(0, 8)}`, ext, await readdir(target))
      await writeFile(join(target, file), bytes)
      copied = true
    }
    if (copied) await this.folder.scan()
    await mkdir(d, { recursive: true })
    await writeFile(join(d, `${taken ?? name}${EXT}`), encodeCena(scene, (h) => this.folder.pathOf(h)))
    return { ok: true }
  }

  /** CAMP-18..20: the scene, with each image read from the campaign now; a missing one refuses the whole scene. */
  async load(name: string): Promise<{ ok: true; scene: Scene } | { ok: false; error: string }> {
    const d = this.dir()
    if (!d) return { ok: false, error: 'Nenhuma campanha aberta' }
    const text = await readFile(join(d, `${name}${EXT}`), 'utf8').catch(() => null)
    if (text === null) return { ok: false, error: MISSING_FILE(`cenas/${name}${EXT}`) }
    const cena = decodeCena(text)
    if ('error' in cena) return { ok: false, error: cena.error }
    const remap: Record<string, string> = {}
    for (const [hash, path] of Object.entries(cena.files)) {
      const img = await readImageFile(join(this.folder.dir()!, ...path.split('/')))
      if (!img.ok) return { ok: false, error: MISSING_FILE(path) }
      const now = this.store.put(img.bytes)
      if (now !== hash) remap[hash] = now // CAMP-20: the file changed, the scene shows it as it is now
    }
    return { ok: true, scene: remapHashes(cena.scene, remap) }
  }
}
