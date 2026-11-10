import { describe, expect, it } from 'vitest'
import { CAMPAIGN_EXISTS, decodeCena, encodeCena, freeName, INVALID_CENA, INVALID_NAME, nameError, remapHashes, safeRelPath, SCENE_EXISTS } from './campaign'
import { DEFAULT_GRID, type Scene } from './types'

const MAP = 'a'.repeat(64)
const TOK = 'b'.repeat(64)
function scene(): Scene {
  return {
    map: { hash: MAP, width: 800, height: 600 },
    grid: { ...DEFAULT_GRID, cell: 100 },
    tokens: {
      g: { id: 'g', name: 'Goblin', hash: TOK, kind: 'character', x: 150, y: 150, width: 1, rotation: 0, ring: 'inimigo', owner: null, hidden: false, movement: 'free' },
      b: { id: 'b', name: 'Baú', hash: TOK, kind: 'object', x: 450, y: 250, width: 0.5, rotation: 90, ring: null, owner: null, hidden: true, movement: 'locked' }
    },
    fog: { base: 'covered', shapes: [{ kind: 'rect', mode: 'reveal', x: 0, y: 0, w: 300, h: 200 }] },
    palette: null
  }
}
const paths: Record<string, string> = { [MAP]: 'mapas/Florestas Frias.jpg', [TOK]: 'tokens/Goblins/goblin.png' }

describe('campaign names', () => {
  it('[C3] CAMP-03 a name of 1 to 60 characters with none of \\ / : * ? " < > | and no edge spaces, not already used, is valid; otherwise the message', () => {
    expect(nameError('Florestas Frias', [])).toBeNull()
    expect(nameError('a'.repeat(60), [])).toBeNull()
    expect(nameError('Ação & Magia (2)', [])).toBeNull()
    expect(nameError('', [])).toBe('Nome inválido')
    expect(nameError('a'.repeat(61), [])).toBe(INVALID_NAME)
    for (const c of ['\\', '/', ':', '*', '?', '"', '<', '>', '|']) expect(nameError(`a${c}b`, []), c).toBe(INVALID_NAME)
    expect(nameError(' Florestas', [])).toBe(INVALID_NAME)
    expect(nameError('Florestas ', [])).toBe(INVALID_NAME)
    expect(nameError('..', [])).toBe(INVALID_NAME)
    expect(nameError('Florestas Frias', ['florestas frias'])).toBe('Campanha já existe')
    expect(nameError('Emboscada', ['EMBOSCADA'], SCENE_EXISTS)).toBe(SCENE_EXISTS)
    expect(CAMPAIGN_EXISTS).toBe('Campanha já existe')
    expect(nameError('🐉'.repeat(60), [])).toBeNull() // characters, not UTF-16 units
  })

  it('a repeated file name gets (2), (3)... ignoring case; no extension works too', () => {
    expect(freeName('goblin', 'png', [])).toBe('goblin.png')
    expect(freeName('goblin', 'png', ['Goblin.PNG'])).toBe('goblin (2).png')
    expect(freeName('goblin', 'png', ['goblin.png', 'goblin (2).png'])).toBe('goblin (3).png')
    expect(freeName('goblin', 'png', ['goblin.png', 'goblin (3).png'])).toBe('goblin (2).png')
    expect(freeName('LEIA-ME', '', ['LEIA-ME'])).toBe('LEIA-ME (2)')
  })

  it('a campaign path is relative, with forward slashes and no .. or drive', () => {
    expect(['mapas/a.png', 'tokens/Goblins/g.png'].map(safeRelPath)).toEqual([true, true])
    expect(['../x.png', 'mapas/../../x', '/etc/passwd', 'C:/x.png', 'mapas\\a.png', '', 'mapas//a.png', './a'].map(safeRelPath)).toEqual([false, false, false, false, false, false, false, false])
  })
})

describe('.cena files', () => {
  it('[C16] CAMP-16 a scene file holds the scene and each image\'s path in the campaign, and no image bytes', () => {
    const text = encodeCena(scene(), (h) => paths[h])
    const file = JSON.parse(text)
    expect(file).toMatchObject({ format: 'mesa-cena', version: 1, files: { [MAP]: 'mapas/Florestas Frias.jpg', [TOK]: 'tokens/Goblins/goblin.png' } })
    expect(file.assets).toBeUndefined()
    expect(text.length).toBeLessThan(2000) // small: no base64 images
    const back = decodeCena(text)
    expect(back).toEqual({ scene: scene(), files: paths })
    // an image without a campaign path cannot be saved as a .cena
    expect(() => encodeCena(scene(), (h) => (h === MAP ? paths[h] : undefined))).toThrow()
  })

  it('a malformed .cena, one missing a path, or one pointing outside the campaign is refused', () => {
    const good = JSON.parse(encodeCena(scene(), (h) => paths[h]))
    const bad = (f: (x: typeof good) => void): string => {
      const c = structuredClone(good)
      f(c)
      return JSON.stringify(c)
    }
    for (const text of ['{ nope', bad((c) => (c.version = 2)), bad((c) => delete c.files[TOK]), bad((c) => (c.files[MAP] = '../../segredo.jpg')), bad((c) => (c.files[MAP] = 'C:/x.jpg')), bad((c) => (c.scene.tokens.g.id = 'x'))]) {
      expect(decodeCena(text), text.slice(0, 50)).toEqual({ error: INVALID_CENA })
    }
  })

  it('[C20] CAMP-20 a changed file\'s new hash replaces the old one in the map and in every item that uses it', () => {
    const NEW = 'c'.repeat(64)
    const s = remapHashes(scene(), { [TOK]: NEW })
    expect(s.tokens.g.hash).toBe(NEW)
    expect(s.tokens.b.hash).toBe(NEW)
    expect(s.map!.hash).toBe(MAP)
    const m = remapHashes(scene(), { [MAP]: NEW })
    expect(m.map!.hash).toBe(NEW)
    expect(m.tokens.g.hash).toBe(TOK)
  })
})
