import { z } from 'zod'
import { fromBase64, toBase64 } from './base64'
import { fromCellFog } from './fog'
import { clampGrid } from './grid'
import { fogShapeSchema } from './protocol'
import type { Scene } from './types'

export const INVALID_MESA = 'Arquivo .mesa inválido'
/** Version 2 keeps the fog as shapes (AD-006); version 1 files, with the cell fog, still load (FOGS-10). */
export const MESA_VERSION = 2

const hash = z.string().regex(/^[0-9a-f]{64}$/)
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/)
const faction = z.enum(['grupo', 'inimigo', 'npc', 'neutro'])
const int = z.number().int()

const cellFog = z.object({ colStart: int, rowStart: int, cols: int.nonnegative(), rows: int.nonnegative(), covered: z.string() })
const shapeFog = z.object({ base: z.enum(['revealed', 'covered']), shapes: z.array(fogShapeSchema) })

const sceneFields = {
  map: z.object({ hash, width: int.positive(), height: int.positive() }).nullable(),
  grid: z.object({ cell: z.number(), offsetX: z.number(), offsetY: z.number(), color, opacity: z.number() }),
  tokens: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string().max(100),
      hash,
      faction,
      size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      col: int,
      row: int,
      owner: z.string().max(100).nullable(),
      hidden: z.boolean()
    })
  ),
  palette: z.record(faction, color).nullable().default(null)
}

const fileSchema = z.discriminatedUnion('version', [
  z.object({ format: z.literal('mesa'), version: z.literal(1), scene: z.object({ ...sceneFields, fog: cellFog.nullable() }), assets: z.record(hash, z.string()) }),
  z.object({ format: z.literal('mesa'), version: z.literal(2), scene: z.object({ ...sceneFields, fog: shapeFog.nullable() }), assets: z.record(hash, z.string()) })
])

/** Every image the scene uses. */
export function sceneHashes(scene: Scene): string[] {
  return [...new Set([...(scene.map ? [scene.map.hash] : []), ...Object.values(scene.tokens).map((t) => t.hash)])]
}

/** SAVE-01: the scene and every image it uses, embedded as base64, in one JSON file. */
export function encodeMesa(scene: Scene, assets: Map<string, Uint8Array>): string {
  const embedded: Record<string, string> = {}
  for (const h of sceneHashes(scene)) {
    const bytes = assets.get(h)
    if (!bytes) throw new Error(`missing image ${h}`)
    embedded[h] = toBase64(bytes)
  }
  return JSON.stringify({ format: 'mesa', version: MESA_VERSION, scene, assets: embedded })
}

/** SAVE-03, SAVE-04: the scene back from a file, or "Arquivo .mesa inválido" for anything malformed or tampered with. */
export function decodeMesa(
  text: string,
  sha256: (bytes: Uint8Array) => string
): { scene: Scene; assets: Map<string, Uint8Array> } | { error: typeof INVALID_MESA } {
  const fail = { error: INVALID_MESA } as const
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return fail
  }
  const parsed = fileSchema.safeParse(data)
  if (!parsed.success) return fail
  const grid = clampGrid(parsed.data.scene.grid)
  const raw = parsed.data
  const fog = raw.version === 1 ? (raw.scene.fog ? fromCellFog(raw.scene.fog, grid) : null) : raw.scene.fog
  const scene: Scene = { ...raw.scene, grid, fog }
  for (const [id, t] of Object.entries(scene.tokens)) if (t.id !== id) return fail
  const assets = new Map<string, Uint8Array>()
  for (const h of sceneHashes(scene)) {
    const b64 = parsed.data.assets[h]
    const bytes = b64 === undefined ? null : fromBase64(b64)
    if (!bytes || sha256(bytes) !== h) return fail
    assets.set(h, bytes)
  }
  return { scene, assets }
}
