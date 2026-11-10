import type { Actor } from './types'

export const MAX_AUDIO_BYTES = 100 * 1024 * 1024
export const MAX_LAYERS = 8
export const FADE_MS = 2000
export const TOO_MANY_LAYERS = 'Máximo de 8 camadas'
const NO_PERMISSION = 'Sem permissão'

export type AudioType = 'mp3' | 'ogg' | 'wav' | 'm4a'

const ascii = (b: Uint8Array, at: number, text: string): boolean =>
  b.length >= at + text.length && [...text].every((c, i) => b[at + i] === c.charCodeAt(0))
const M4A_BRANDS = ['M4A ', 'M4B ', 'mp41', 'mp42', 'isom', 'iso2', 'dash']

/** SOM-03: the audio type from the file's own header, or null when it is not MP3, OGG, WAV or M4A. */
export function audioInfo(bytes: Uint8Array): AudioType | null {
  if (ascii(bytes, 0, 'ID3') || (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return 'mp3'
  if (ascii(bytes, 0, 'OggS')) return 'ogg'
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WAVE')) return 'wav'
  if (ascii(bytes, 4, 'ftyp') && M4A_BRANDS.some((b) => ascii(bytes, 8, b))) return 'm4a'
  return null
}

/** One music layer: started at `startedAt` (server clock, ms), fading out since `stoppingAt` when turned off. */
export interface Layer {
  hash: string
  volume: number
  startedAt: number
  stoppingAt: number | null
}
export interface Sound {
  layers: Layer[]
}
export const emptySound = (): Sound => ({ layers: [] })

export type SoundAction =
  | { type: 'sound/toggle'; hash: string }
  | { type: 'sound/volume'; hash: string; volume: number }
  | { type: 'sound/stopAll' }
  | { type: 'sound/set'; layers: Array<{ hash: string; volume: number }> }
  | { type: 'sound/effect'; hash: string }

export type SoundResult = { ok: true; sound: Sound; effect?: { hash: string; at: number } } | { ok: false; reason: string }

const clampVolume = (v: number): number => Math.round(Math.min(100, Math.max(0, v)))
const live = (l: Layer): boolean => l.stoppingAt === null

/** Drops the layers whose fade-out is over. */
export function pruneLayers(sound: Sound, now: number): Sound {
  const layers = sound.layers.filter((l) => l.stoppingAt === null || now - l.stoppingAt < FADE_MS)
  return layers.length === sound.layers.length ? sound : { layers }
}

/** SOM-06..11, SOM-16, SOM-19, SOM-26, SOM-27: the master's sound actions; a player's are refused. */
export function applySound(sound: Sound, actor: Actor, action: SoundAction, now: number): SoundResult {
  if (actor.role !== 'master') return { ok: false, reason: NO_PERMISSION }
  const s = pruneLayers(sound, now)
  switch (action.type) {
    case 'sound/toggle': {
      const at = s.layers.find((l) => l.hash === action.hash)
      if (at && live(at)) return { ok: true, sound: { layers: s.layers.map((l) => (l === at ? { ...l, stoppingAt: now } : l)) } }
      if (s.layers.filter(live).length >= MAX_LAYERS) return { ok: false, reason: TOO_MANY_LAYERS }
      // a layer clicked while fading out rises again from where it is
      if (at) return { ok: true, sound: { layers: s.layers.map((l) => (l === at ? { ...l, stoppingAt: null } : l)) } }
      return { ok: true, sound: { layers: [...s.layers, { hash: action.hash, volume: 100, startedAt: now, stoppingAt: null }] } }
    }
    case 'sound/volume': {
      if (!s.layers.some((l) => l.hash === action.hash)) return { ok: true, sound: s }
      return { ok: true, sound: { layers: s.layers.map((l) => (l.hash === action.hash ? { ...l, volume: clampVolume(action.volume) } : l)) } }
    }
    case 'sound/stopAll':
      return { ok: true, sound: { layers: s.layers.map((l) => (live(l) ? { ...l, stoppingAt: now } : l)) } }
    case 'sound/set': {
      const wanted = new Map(action.layers.map((l) => [l.hash, clampVolume(l.volume)]))
      if (wanted.size > MAX_LAYERS) return { ok: false, reason: TOO_MANY_LAYERS }
      const layers: Layer[] = s.layers.map((l) =>
        wanted.has(l.hash) ? { ...l, volume: wanted.get(l.hash)!, stoppingAt: null } : live(l) ? { ...l, stoppingAt: now } : l
      )
      for (const [hash, volume] of wanted) if (!s.layers.some((l) => l.hash === hash)) layers.push({ hash, volume, startedAt: now, stoppingAt: null })
      return { ok: true, sound: { layers } }
    }
    case 'sound/effect':
      return { ok: true, sound: s, effect: { hash: action.hash, at: now } }
  }
}

/** SOM-12, SOM-13: seconds into the loop a layer started at `startedAt` is at, on the server clock. */
export function layerPosition(startedAt: number, serverNow: number, duration: number): number {
  if (!(duration > 0)) return 0
  const t = Math.max(0, (serverNow - startedAt) / 1000)
  return t % duration
}
