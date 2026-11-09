import { DEFAULT_FACTION_COLORS, FACTIONS, type FactionColors } from './types'

const HEX = /^#[0-9a-fA-F]{6}$/

/**
 * TOK-09: ring colours from the campaign `palette.json`. Faction colours are read at the top level
 * or under `faccoes`; any faction missing or not `#rrggbb` keeps its default colour.
 */
export function parsePalette(json: string | null): FactionColors {
  const colors: FactionColors = { ...DEFAULT_FACTION_COLORS }
  if (json === null) return colors
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return colors
  }
  if (!data || typeof data !== 'object') return colors
  const root = data as Record<string, unknown>
  const nested = root.faccoes && typeof root.faccoes === 'object' ? (root.faccoes as Record<string, unknown>) : {}
  for (const f of FACTIONS) {
    const v = nested[f] ?? root[f]
    if (typeof v === 'string' && HEX.test(v)) colors[f] = v.toLowerCase()
  }
  return colors
}
