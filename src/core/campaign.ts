import { sceneHashes, sceneSchemaV3 } from './mesa-file'
import { z } from 'zod'
import type { Scene } from './types'

export const INVALID_NAME = 'Nome inválido'
export const CAMPAIGN_EXISTS = 'Campanha já existe'
export const SCENE_EXISTS = 'Cena já existe'
export const INVALID_CENA = 'Arquivo de cena inválido'
export const NAME_MAX = 60
/** The six folders of a campaign (CAMP-02). */
export const CAMPAIGN_FOLDERS = ['mapas', 'tokens', 'objetos', 'musicas', 'efeitos', 'cenas'] as const

const FORBIDDEN = /[\\/:*?"<>|]/

/** CAMP-03: 1..60 characters, none Windows forbids, no edge spaces, not already used (ignoring case). */
export function nameError(name: string, existing: readonly string[], exists = CAMPAIGN_EXISTS): string | null {
  const chars = [...name].length
  if (chars < 1 || chars > NAME_MAX || name.trim() !== name || FORBIDDEN.test(name) || [...name].some((c) => c.charCodeAt(0) < 32) || name === '.' || name === '..') return INVALID_NAME
  const lower = name.toLocaleLowerCase()
  if (existing.some((e) => e.toLocaleLowerCase() === lower)) return exists
  return null
}

/** CAMP-14: `base.ext`, or `base (2).ext`, `base (3).ext`... the first that is not taken (ignoring case). */
export function freeName(base: string, ext: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((e) => e.toLocaleLowerCase()))
  const dot = ext ? `.${ext}` : ''
  if (!taken.has(`${base}${dot}`.toLocaleLowerCase())) return `${base}${dot}`
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${dot}`
    if (!taken.has(candidate.toLocaleLowerCase())) return candidate
  }
}

/** A path inside the campaign: relative, forward slashes, no `..`, no drive or root. */
export function safeRelPath(p: string): boolean {
  if (!p || p.startsWith('/') || p.includes('\\') || /^[a-zA-Z]:/.test(p)) return false
  return p.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
}

const cenaSchema = z.object({
  format: z.literal('mesa-cena'),
  version: z.literal(1),
  scene: sceneSchemaV3,
  files: z.record(z.string().regex(/^[0-9a-f]{64}$/), z.string()),
  /** SOM-25: the music layers playing when it was saved; absent in scenes saved before sounds (SOM-27). */
  sound: z.array(z.object({ path: z.string(), volume: z.number().min(0).max(100) })).max(8).optional()
})

/** A music layer of a scene: the file in the campaign and its volume (SOM-25). */
export interface CenaLayer {
  path: string
  volume: number
}

export interface Cena {
  scene: Scene
  /** Each image the scene uses → its path inside the campaign. */
  files: Record<string, string>
  sound: CenaLayer[]
}

/** CAMP-16: a light scene file: the scene and where each of its images is in the campaign; no image bytes. */
export function encodeCena(scene: Scene, pathOf: (hash: string) => string | undefined, sound: CenaLayer[] = []): string {
  const files: Record<string, string> = {}
  for (const h of sceneHashes(scene)) {
    const p = pathOf(h)
    if (!p || !safeRelPath(p)) throw new Error(`no campaign path for ${h}`)
    files[h] = p
  }
  if (!sound.every((l) => safeRelPath(l.path))) throw new Error('sound path outside the campaign')
  return JSON.stringify({ format: 'mesa-cena', version: 1, scene, files, sound })
}

/** The scene back from a `.cena`, or "Arquivo de cena inválido" when it is malformed or points outside the campaign. */
export function decodeCena(text: string): Cena | { error: typeof INVALID_CENA } {
  const fail = { error: INVALID_CENA } as const
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail
  }
  const r = cenaSchema.safeParse(data)
  if (!r.success) return fail
  const scene = r.data.scene as Scene
  for (const h of sceneHashes(scene)) if (!r.data.files[h]) return fail
  if (!Object.values(r.data.files).every(safeRelPath)) return fail
  const sound = r.data.sound ?? []
  if (!sound.every((l) => safeRelPath(l.path))) return fail
  for (const [id, t] of Object.entries(scene.tokens)) if (t.id !== id) return fail
  return { scene, files: r.data.files, sound }
}

/** CAMP-20: the scene with each old image hash replaced by the hash its file has now. */
export function remapHashes(scene: Scene, map: Readonly<Record<string, string>>): Scene {
  const to = (h: string): string => map[h] ?? h
  const tokens = Object.fromEntries(Object.entries(scene.tokens).map(([id, t]) => [id, { ...t, hash: to(t.hash) }]))
  return { ...scene, map: scene.map ? { ...scene.map, hash: to(scene.map.hash) } : null, tokens }
}
