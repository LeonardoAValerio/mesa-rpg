import { clampWidth, type ItemKind } from './items'
import { FACTIONS, type Faction } from './types'

export interface TokenMeta {
  name: string
  kind: ItemKind
  width: number
  ring: Faction | null
}

/** "goblin.png" → "goblin" */
export function baseName(fileName: string): string {
  const leaf = fileName.split(/[\\/]/).pop() ?? fileName
  return leaf.replace(/\.[^.]+$/, '')
}

/**
 * TOK-01, TOK-03, ITEM-11: an item's name, kind, width and ring from the kit's `<name>.json` beside the PNG
 * (`nome`, `tipo`: personagem / objeto, `tamanho`: 0.25..20 cells, `faccao`). A missing file, invalid JSON or a value
 * outside the allowed set falls back field by field: the file name, personagem, 1 cell, no ring.
 */
export function parseManifest(json: string | null, fileName: string): TokenMeta {
  const meta: TokenMeta = { name: baseName(fileName), kind: 'character', width: 1, ring: null }
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
  if (d.tipo === 'objeto') meta.kind = 'object'
  if (typeof d.tamanho === 'number' && d.tamanho >= 0.25 && d.tamanho <= 20) meta.width = clampWidth(d.tamanho)
  if (meta.kind === 'character' && typeof d.faccao === 'string' && (FACTIONS as readonly string[]).includes(d.faccao)) meta.ring = d.faccao as Faction
  return meta
}
