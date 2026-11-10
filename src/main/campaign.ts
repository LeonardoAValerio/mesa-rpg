import { watch, type FSWatcher } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { CAMPAIGN_FOLDERS, freeName, nameError } from '../core/campaign'
import type { ItemKind } from '../core/items'
import { baseName, parseManifest } from '../core/manifest'
import type { Faction } from '../core/types'
import type { AssetStore } from './asset-store'
import type { AudioType } from '../core/sound'
import { readAudioFile, readImageFile } from './import'

export type Section = 'mapas' | 'tokens' | 'objetos'
export const SECTIONS: Section[] = ['mapas', 'tokens', 'objetos']
export type SoundSection = 'musicas' | 'efeitos'
export const SOUND_SECTIONS: SoundSection[] = ['musicas', 'efeitos']
const IMAGE = /\.(png|jpe?g|webp)$/i
const AUDIO = /\.(mp3|ogg|oga|wav|m4a)$/i

/** One audio file of `musicas/` or `efeitos/` (SOM-01). */
export interface SoundEntry {
  section: SoundSection
  path: string
  group: string
  name: string
  hash: string
  type: AudioType
}

/** One image of the campaign as the panels list it (CAMP-08, CAMP-09). */
export interface CampaignEntry {
  section: Section
  /** Path inside the campaign, with forward slashes: `tokens/Goblins/goblin.png`. */
  path: string
  /** The subfolder inside the section (`Goblins`, `Goblins/Chefes`), empty at the top (CAMP-10). */
  group: string
  name: string
  hash: string
  kind: ItemKind
  width: number
  ring: Faction | null
  w: number
  h: number
}

interface Cached {
  mtimeMs: number
  size: number
  manifest: string | null
  entry: CampaignEntry | SoundEntry | null
}

/** CAMP-01..15: the campaigns under `Documentos/Mesa RPG/`, and the open one read into the asset store and watched. */
export class CampaignFolder {
  private current: string | null = null
  private watcher: FSWatcher | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private cache = new Map<string, Cached>()
  private entries: CampaignEntry[] = []
  private soundEntries: SoundEntry[] = []
  private listeners = new Set<(entries: CampaignEntry[]) => void>()

  constructor(readonly root: string, private readonly store: AssetStore, private readonly debounceMs = 300) {}

  /** CAMP-01: the folders inside the root, creating the root when it is missing. */
  async list(): Promise<string[]> {
    await mkdir(this.root, { recursive: true })
    const items = await readdir(this.root, { withFileTypes: true })
    return items.filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => a.localeCompare(b))
  }

  /** CAMP-02, CAMP-03: a new campaign with its six folders, or the reason it was refused. */
  async create(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const error = nameError(name, await this.list())
    if (error) return { ok: false, error }
    await this.ensure(name)
    return { ok: true }
  }

  /** CAMP-05: any of the six folders that is missing is created. */
  async ensure(name: string): Promise<void> {
    for (const f of CAMPAIGN_FOLDERS) await mkdir(join(this.root, name, f), { recursive: true })
  }

  dir(name = this.current): string | null {
    return name ? join(this.root, name) : null
  }

  get name(): string | null {
    return this.current
  }

  /** Opens a campaign: its folders, a first read, and a watch that reads it again after each change (CAMP-11). */
  async open(name: string): Promise<CampaignEntry[]> {
    this.close()
    await this.ensure(name)
    this.current = name
    const dir = this.dir()!
    await this.scan()
    try {
      this.watcher = watch(dir, { recursive: true }, () => this.schedule())
      this.watcher.on('error', () => this.schedule())
    } catch {
      // no watch on this system: the lists show what was there when the table opened
    }
    return this.entries
  }

  onChange(fn: (entries: CampaignEntry[]) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.scan().then((entries) => {
        for (const fn of this.listeners) fn(entries)
      })
    }, this.debounceMs)
  }

  /** The entries of the last read. */
  get all(): CampaignEntry[] {
    return this.entries
  }

  /** SOM-01: the audio files of the last read. */
  get sounds(): SoundEntry[] {
    return this.soundEntries
  }

  /** The campaign path of an image or audio file, if the campaign holds it. */
  pathOf(hash: string): string | undefined {
    return (this.entries.find((e) => e.hash === hash) ?? this.soundEntries.find((e) => e.hash === hash))?.path
  }

  /** CAMP-08..10, CAMP-15: every readable image of mapas/, tokens/ and objetos/, in their subfolders; others are left out. */
  async scan(): Promise<CampaignEntry[]> {
    const dir = this.dir()
    if (!dir) {
      this.soundEntries = []
      return (this.entries = [])
    }
    const seen = new Set<string>()
    const out: CampaignEntry[] = []
    for (const section of SECTIONS) {
      for (const file of await walk(join(dir, section))) {
        if (!IMAGE.test(file)) continue
        const path = relative(dir, file).split(sep).join('/')
        seen.add(path)
        const entry = await this.read(file, path, section)
        if (entry) out.push(entry)
      }
    }
    const sounds: SoundEntry[] = []
    for (const section of SOUND_SECTIONS) {
      for (const file of await walk(join(dir, section))) {
        if (!AUDIO.test(file)) continue
        const path = relative(dir, file).split(sep).join('/')
        seen.add(path)
        const entry = await this.readSound(file, path, section)
        if (entry) sounds.push(entry)
      }
    }
    sounds.sort((a, b) => a.section.localeCompare(b.section) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    this.soundEntries = sounds
    for (const p of this.cache.keys()) if (!seen.has(p)) this.cache.delete(p)
    out.sort((a, b) => a.section.localeCompare(b.section) || a.group.localeCompare(b.group) || a.name.localeCompare(b.name))
    this.entries = out
    return out
  }

  /** SOM-03: an audio file by its header and size; a bad one is left out. */
  private async readSound(file: string, path: string, section: SoundSection): Promise<SoundEntry | null> {
    const st = await stat(file).catch(() => null)
    if (!st) return null
    const hit = this.cache.get(path)
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit.entry as SoundEntry | null
    const audio = await readAudioFile(file)
    const parts = path.split('/')
    const entry: SoundEntry | null = audio.ok
      ? { section, path, group: parts.slice(1, -1).join('/'), name: baseName(parts[parts.length - 1]), hash: this.store.put(audio.bytes), type: audio.type }
      : null
    this.cache.set(path, { mtimeMs: st.mtimeMs, size: st.size, manifest: null, entry })
    return entry
  }

  private async read(file: string, path: string, section: Section): Promise<CampaignEntry | null> {
    const st = await stat(file).catch(() => null)
    if (!st) return null
    const manifest = section === 'mapas' ? null : await readFile(file.replace(/\.[^.]+$/, '.json'), 'utf8').catch(() => null)
    const hit = this.cache.get(path)
    if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size && hit.manifest === manifest) return hit.entry as CampaignEntry | null
    const img = await readImageFile(file)
    let entry: CampaignEntry | null = null
    if (img.ok) {
      const leaf = path.split('/').pop()!
      const meta = parseManifest(manifest, leaf)
      // the .json's tipo wins; without one, the folder decides (CAMP-08)
      const saysKind = manifestTipo(manifest)
      const kind: ItemKind = saysKind ? meta.kind : section === 'objetos' ? 'object' : 'character'
      const parts = path.split('/')
      entry = {
        section,
        path,
        group: parts.slice(1, -1).join('/'),
        name: section === 'mapas' ? baseName(leaf) : meta.name,
        hash: this.store.put(img.bytes),
        kind,
        width: meta.width,
        ring: kind === 'object' ? null : meta.ring,
        w: img.info.width,
        h: img.info.height
      }
    }
    this.cache.set(path, { mtimeMs: st.mtimeMs, size: st.size, manifest, entry })
    return entry
  }

  /** CAMP-14: copies the files into the section, a repeated name becoming `name (2).ext`; returns the new paths. */
  async addFiles(section: Section | SoundSection, sources: string[]): Promise<string[]> {
    const dir = this.dir()
    if (!dir) return []
    const target = join(dir, section)
    await mkdir(target, { recursive: true })
    const added: string[] = []
    for (const src of sources) {
      const existing = await readdir(target)
      const leaf = src.split(/[\\/]/).pop()!
      const dot = leaf.lastIndexOf('.')
      const name = freeName(dot > 0 ? leaf.slice(0, dot) : leaf, dot > 0 ? leaf.slice(dot + 1) : '', existing)
      await copyFile(src, join(target, name))
      added.push(`${section}/${name}`)
    }
    await this.scan()
    return added
  }

  close(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    this.current = null
    this.cache.clear()
    this.entries = []
    this.soundEntries = []
  }
}

function manifestTipo(manifest: string | null): boolean {
  try {
    const d = manifest ? (JSON.parse(manifest) as Record<string, unknown>) : null
    return !!d && (d.tipo === 'objeto' || d.tipo === 'personagem')
  } catch {
    return false
  }
}

async function walk(dir: string): Promise<string[]> {
  const items = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const out: string[] = []
  for (const d of items) {
    const p = join(dir, d.name)
    if (d.isDirectory()) out.push(...(await walk(p)))
    else if (d.isFile()) out.push(p)
  }
  return out
}
