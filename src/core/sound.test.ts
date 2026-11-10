import { describe, expect, it } from 'vitest'
import { FADE_MS, TOO_MANY_LAYERS, applySound, audioInfo, emptySound, layerPosition, pruneLayers, type Sound, type SoundAction } from './sound'

const master = { role: 'master' as const, name: 'Mestre' }
const ana = { role: 'player' as const, name: 'Ana' }
const h = (n: number): string => n.toString(16).padStart(64, '0')
const bytes = (...parts: Array<string | number[]>): Uint8Array =>
  new Uint8Array(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)))
const run = (s: Sound, a: SoundAction, now = 1000): Sound => {
  const r = applySound(s, master, a, now)
  if (!r.ok) throw new Error(r.reason)
  return r.sound
}

describe('audioInfo (SOM-03)', () => {
  it('knows MP3 (ID3 tag and bare frame), OGG, WAV and M4A by their headers', () => {
    expect(audioInfo(bytes('ID3', [3, 0, 0]))).toBe('mp3')
    expect(audioInfo(bytes([0xff, 0xfb, 0x90, 0x00]))).toBe('mp3')
    expect(audioInfo(bytes('OggS', [0, 2]))).toBe('ogg')
    expect(audioInfo(bytes('RIFF', [0, 0, 0, 0], 'WAVE', 'fmt '))).toBe('wav')
    expect(audioInfo(bytes([0, 0, 0, 0x20], 'ftyp', 'M4A ', [0, 0, 0, 0]))).toBe('m4a')
    expect(audioInfo(bytes([0, 0, 0, 0x20], 'ftyp', 'mp42'))).toBe('m4a')
  })
  it('refuses anything else: a PNG, a RIFF that is not WAVE (AVI), an MP4 video brand, text, empty', () => {
    expect(audioInfo(bytes([0x89], 'PNG', [13, 10, 26, 10]))).toBeNull()
    expect(audioInfo(bytes('RIFF', [0, 0, 0, 0], 'AVI '))).toBeNull()
    expect(audioInfo(bytes([0, 0, 0, 0x20], 'ftyp', 'qt  '))).toBeNull()
    expect(audioInfo(bytes('hello world'))).toBeNull()
    expect(audioInfo(new Uint8Array())).toBeNull()
  })
})

describe('applySound', () => {
  it('SOM-06 a click starts a layer at volume 100 at the server time', () => {
    expect(run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 5000).layers).toEqual([{ hash: h(1), volume: 100, startedAt: 5000, stoppingAt: null }])
  })

  it('SOM-07 a second click marks it stopping; it leaves 2 s later', () => {
    const on = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 1000)
    const off = run(on, { type: 'sound/toggle', hash: h(1) }, 3000)
    expect(off.layers[0].stoppingAt).toBe(3000)
    expect(pruneLayers(off, 3000 + FADE_MS - 1).layers).toHaveLength(1)
    expect(pruneLayers(off, 3000 + FADE_MS).layers).toHaveLength(0)
  })

  it('a click while it fades out brings it back, keeping its place in the loop', () => {
    const on = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 1000)
    const off = run(on, { type: 'sound/toggle', hash: h(1) }, 3000)
    expect(run(off, { type: 'sound/toggle', hash: h(1) }, 4000).layers).toEqual([{ hash: h(1), volume: 100, startedAt: 1000, stoppingAt: null }])
  })

  it('SOM-10 the 9th live layer is refused with "Máximo de 8 camadas"; a fading one does not count', () => {
    let s = emptySound()
    for (let i = 1; i <= 8; i++) s = run(s, { type: 'sound/toggle', hash: h(i) })
    expect(applySound(s, master, { type: 'sound/toggle', hash: h(9) }, 1000)).toEqual({ ok: false, reason: TOO_MANY_LAYERS })
    s = run(s, { type: 'sound/toggle', hash: h(1) }) // fading out
    expect(run(s, { type: 'sound/toggle', hash: h(9) }).layers.filter((l) => l.stoppingAt === null)).toHaveLength(8)
    // bringing back a fading one while 8 are live is refused too
    expect(applySound(run(s, { type: 'sound/toggle', hash: h(9) }), master, { type: 'sound/toggle', hash: h(1) }, 1000)).toEqual({ ok: false, reason: TOO_MANY_LAYERS })
  })

  it('SOM-09 sets a layer volume within 0..100, rounding and clamping', () => {
    const on = run(emptySound(), { type: 'sound/toggle', hash: h(1) })
    expect(run(on, { type: 'sound/volume', hash: h(1), volume: 30 }).layers[0].volume).toBe(30)
    expect(run(on, { type: 'sound/volume', hash: h(1), volume: 0 }).layers[0].volume).toBe(0)
    expect(run(on, { type: 'sound/volume', hash: h(1), volume: -5 }).layers[0].volume).toBe(0)
    expect(run(on, { type: 'sound/volume', hash: h(1), volume: 140 }).layers[0].volume).toBe(100)
    expect(run(on, { type: 'sound/volume', hash: h(1), volume: 33.6 }).layers[0].volume).toBe(34)
    expect(run(on, { type: 'sound/volume', hash: h(2), volume: 10 })).toEqual(on) // no such layer
  })

  it('SOM-11 stop all marks every live layer stopping at once', () => {
    let s = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 0)
    s = run(s, { type: 'sound/toggle', hash: h(2) }, 0)
    expect(run(s, { type: 'sound/stopAll' }, 900).layers.map((l) => l.stoppingAt)).toEqual([900, 900])
  })

  it('SOM-26 set keeps a layer in the list (new volume), starts a missing one and fades out the rest', () => {
    let s = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 0)
    s = run(s, { type: 'sound/toggle', hash: h(2) }, 0)
    const r = run(s, { type: 'sound/set', layers: [{ hash: h(1), volume: 60 }, { hash: h(3), volume: 40 }] }, 500)
    expect(r.layers).toEqual([
      { hash: h(1), volume: 60, startedAt: 0, stoppingAt: null },
      { hash: h(2), volume: 100, startedAt: 0, stoppingAt: 500 },
      { hash: h(3), volume: 40, startedAt: 500, stoppingAt: null }
    ])
  })

  it('SOM-27 set with no layers fades every layer out', () => {
    const s = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 0)
    expect(run(s, { type: 'sound/set', layers: [] }, 700).layers[0].stoppingAt).toBe(700)
  })

  it('set with more than 8 layers is refused', () => {
    const layers = Array.from({ length: 9 }, (_, i) => ({ hash: h(i + 1), volume: 50 }))
    expect(applySound(emptySound(), master, { type: 'sound/set', layers }, 0)).toEqual({ ok: false, reason: TOO_MANY_LAYERS })
  })

  it('SOM-16 an effect is stamped with the server time and leaves the layers alone', () => {
    const s = run(emptySound(), { type: 'sound/toggle', hash: h(1) }, 0)
    expect(applySound(s, master, { type: 'sound/effect', hash: h(7) }, 1234)).toEqual({ ok: true, sound: s, effect: { hash: h(7), at: 1234 } })
  })

  it('SOM-19 every sound action from a player is refused with "Sem permissão"', () => {
    const s = run(emptySound(), { type: 'sound/toggle', hash: h(1) })
    const actions: SoundAction[] = [
      { type: 'sound/toggle', hash: h(1) },
      { type: 'sound/volume', hash: h(1), volume: 5 },
      { type: 'sound/stopAll' },
      { type: 'sound/set', layers: [] },
      { type: 'sound/effect', hash: h(2) }
    ]
    for (const a of actions) expect(applySound(s, ana, a, 1000), a.type).toEqual({ ok: false, reason: 'Sem permissão' })
  })
})

describe('layerPosition (SOM-12, SOM-13)', () => {
  it('is the time since the start, wrapped by the loop length', () => {
    expect(layerPosition(1000, 1000, 30)).toBe(0)
    expect(layerPosition(1000, 13_500, 30)).toBe(12.5)
    expect(layerPosition(0, 95_000, 30)).toBe(5)
    expect(layerPosition(5000, 4000, 30)).toBe(0) // clock slightly behind: the start
    expect(layerPosition(0, 1000, 0)).toBe(0) // no duration yet
  })
})
