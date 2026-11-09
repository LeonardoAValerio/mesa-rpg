import { FACTIONS, type Faction, type TokenSize } from './types'

export interface TokenMeta {
  name: string
  faction: Faction
  size: TokenSize
}

/** "goblin.png" → "goblin" */
export function baseName(fileName: string): string {
  const leaf = fileName.split(/[\\/]/).pop() ?? fileName
  return leaf.replace(/\.[^.]+$/, '')
}

/**
 * TOK-01..03: a token's name, faction and size from the kit's `<name>.json` beside the PNG.
 * A missing file, invalid JSON or a value outside the allowed set falls back field by field:
 * the file name, `neutro`, size 1.
 */
export function parseManifest(json: string | null, fileName: string): TokenMeta {
  const meta: TokenMeta = { name: baseName(fileName), faction: 'neutro', size: 1 }
  if (json === null) return meta
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return meta
  }
  if (!data || typeof data !== 'object') return meta
  const d = data as Record<string, unknown>
  if (typeof d.nome === 'string' && d.nome.trim()) meta.name = d.nome.trim().slice(0, 100)
  if (typeof d.faccao === 'string' && (FACTIONS as readonly string[]).includes(d.faccao)) meta.faction = d.faccao as Faction
  if (d.tamanho === 1 || d.tamanho === 2 || d.tamanho === 3) meta.size = d.tamanho
  return meta
}
