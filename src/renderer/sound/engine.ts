import { FADE_MS, layerPosition, type Layer } from '../../core/sound'

/** SOM-18: an effect whose file arrives later than this after the master's click is skipped. */
export const LATE_EFFECT_MS = 2000
/** SOM-09: a new layer volume is reached this fast. */
const VOLUME_STEP_S = 0.1

/** SOM-20: one person's own volumes, 0..100. */
export interface Personal {
  music: number
  effects: number
  muted: boolean
}
export const DEFAULT_PERSONAL: Personal = { music: 80, effects: 80, muted: false }

/** The part of Web Audio the engine uses, so tests can hand it a fake. */
export type AudioCtx = Pick<AudioContext, 'currentTime' | 'destination' | 'createGain' | 'createBufferSource' | 'decodeAudioData' | 'close'>

export interface SoundDeps {
  ctx: AudioCtx
  /** The file's bytes (cache or the master), or null when it cannot be had. */
  load(hash: string): Promise<Uint8Array | null>
  /** The master's clock (ms). */
  serverNow(): number
}

interface Playing {
  hash: string
  volume: number
  startedAt: number
  gain: GainNode
  source: AudioBufferSourceNode | null
  duration: number
  /** ctx time at which the source started, and the loop position it started at. */
  startCtx: number
  offset: number
  stopping: boolean
  stopTimer: ReturnType<typeof setTimeout> | null
  /** ctx time when the 2-second rise ends. */
  riseEnd: number
}

export interface SoundSnapshot {
  layers: Array<{ hash: string; gain: number; position: number; playing: boolean; stopping: boolean }>
  effects: Array<{ hash: string; at: number; played: boolean | null }>
  music: number
  effectsVolume: number
  muted: boolean
  musicBus: number
  effectsBus: number
}

/**
 * SOM-06..18, SOM-20..23: plays the table's music layers in sync with the master's clock, with the 2-second rise and
 * fade, the effects the master plays, and this person's own volumes. One gain bus for music and one for effects.
 */
export class SoundEngine {
  private readonly playing = new Map<string, Playing>()
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>()
  private readonly effectLog: SoundSnapshot['effects'] = []
  private readonly musicBus: GainNode
  private readonly effectsBus: GainNode
  private personal: Personal = { ...DEFAULT_PERSONAL }
  private closed = false

  constructor(private readonly deps: SoundDeps) {
    this.musicBus = deps.ctx.createGain()
    this.effectsBus = deps.ctx.createGain()
    this.musicBus.connect(deps.ctx.destination)
    this.effectsBus.connect(deps.ctx.destination)
    this.applyPersonal()
  }

  /** SOM-20..23: this person's volumes; nothing is sent anywhere. */
  setPersonal(p: Personal): void {
    this.personal = { ...p }
    this.applyPersonal()
  }

  private applyPersonal(): void {
    const off = this.personal.muted
    set(this.musicBus.gain, off ? 0 : this.personal.music / 100, this.deps.ctx.currentTime)
    set(this.effectsBus.gain, off ? 0 : this.personal.effects / 100, this.deps.ctx.currentTime)
  }

  /** SOM-17: downloads and decodes files ahead, so they play without a wait. */
  preload(hashes: string[]): void {
    for (const h of hashes) void this.buffer(h)
  }

  private buffer(hash: string): Promise<AudioBuffer | null> {
    let b = this.buffers.get(hash)
    if (!b) {
      b = this.deps
        .load(hash)
        .then((bytes) => (bytes ? this.deps.ctx.decodeAudioData(bytes.slice().buffer) : null))
        .catch(() => null)
      this.buffers.set(hash, b)
      void b.then((x) => x === null && this.buffers.delete(hash)) // a failed file is asked again next time
    }
    return b
  }

  /** SOM-06, SOM-07, SOM-09, SOM-11, SOM-12, SOM-14: brings what plays here in line with the table's layers. */
  setLayers(layers: Layer[]): void {
    if (this.closed) return
    const now = this.deps.serverNow()
    const t = this.deps.ctx.currentTime
    for (const l of layers) {
      const p = this.playing.get(l.hash)
      if (!p) {
        if (l.stoppingAt === null) this.start(l)
        continue
      }
      if (l.stoppingAt !== null) {
        if (!p.stopping) this.fadeOut(p, FADE_MS - (now - l.stoppingAt))
        continue
      }
      if (p.stopping) {
        // clicked again while fading out: rises again from where it is
        p.stopping = false
        if (p.stopTimer) clearTimeout(p.stopTimer)
        p.stopTimer = null
        p.volume = l.volume
        p.riseEnd = t + FADE_MS / 1000
        ramp(p.gain.gain, l.volume / 100, t, FADE_MS / 1000)
        continue
      }
      if (p.volume !== l.volume) {
        p.volume = l.volume
        if (p.source) ramp(p.gain.gain, l.volume / 100, t, Math.max(VOLUME_STEP_S, p.riseEnd - t))
      }
    }
    for (const p of [...this.playing.values()]) if (!layers.some((l) => l.hash === p.hash)) this.stopNow(p)
  }

  private start(l: Layer): void {
    const gain = this.deps.ctx.createGain()
    gain.gain.value = 0
    gain.connect(this.musicBus)
    const p: Playing = { hash: l.hash, volume: l.volume, startedAt: l.startedAt, gain, source: null, duration: 0, startCtx: 0, offset: 0, stopping: false, stopTimer: null, riseEnd: 0 }
    this.playing.set(l.hash, p)
    void this.buffer(l.hash).then((buffer) => {
      if (!buffer || this.closed || this.playing.get(l.hash) !== p || p.stopping) return
      const ctx = this.deps.ctx
      const t = ctx.currentTime
      const elapsed = this.deps.serverNow() - p.startedAt
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.loop = true
      source.connect(gain)
      p.duration = buffer.duration
      p.offset = layerPosition(p.startedAt, this.deps.serverNow(), buffer.duration) // SOM-12, SOM-14: the table's point now
      p.startCtx = t
      p.source = source
      source.start(0, p.offset)
      if (elapsed < FADE_MS) {
        // SOM-06: the rest of the 2-second rise, from where the master's is
        const from = (p.volume / 100) * Math.max(0, elapsed / FADE_MS)
        set(gain.gain, from, t)
        p.riseEnd = t + (FADE_MS - elapsed) / 1000
        gain.gain.linearRampToValueAtTime(p.volume / 100, p.riseEnd)
      } else set(gain.gain, p.volume / 100, t)
    })
  }

  private fadeOut(p: Playing, ms: number): void {
    p.stopping = true
    const left = Math.max(0, ms)
    ramp(p.gain.gain, 0, this.deps.ctx.currentTime, left / 1000)
    p.stopTimer = setTimeout(() => {
      if (this.playing.get(p.hash) === p && p.stopping) this.stopNow(p)
    }, left)
  }

  private stopNow(p: Playing): void {
    if (p.stopTimer) clearTimeout(p.stopTimer)
    try {
      p.source?.stop()
    } catch {
      // never started
    }
    p.source?.disconnect()
    p.gain.disconnect()
    this.playing.delete(p.hash)
  }

  /** SOM-16, SOM-18: plays an effect once, unless its file came more than 2 s after the master's click. */
  async playEffect(hash: string, at: number): Promise<void> {
    const rec = { hash, at, played: null as boolean | null }
    this.effectLog.push(rec)
    if (this.effectLog.length > 50) this.effectLog.shift()
    const buffer = await this.buffer(hash)
    if (!buffer || this.closed || this.deps.serverNow() - at > LATE_EFFECT_MS) {
      rec.played = false
      return
    }
    const source = this.deps.ctx.createBufferSource()
    source.buffer = buffer
    source.connect(this.effectsBus)
    source.onended = () => source.disconnect()
    source.start()
    rec.played = true
  }

  /** SOM-15: every sound stops (connection lost); the layers come back with the next view. */
  stopAll(): void {
    for (const p of [...this.playing.values()]) this.stopNow(p)
  }

  close(): void {
    this.stopAll()
    this.closed = true
    void this.deps.ctx.close().catch(() => {})
  }

  snapshot(): SoundSnapshot {
    const t = this.deps.ctx.currentTime
    return {
      layers: [...this.playing.values()].map((p) => ({
        hash: p.hash,
        gain: p.gain.gain.value,
        position: p.source && p.duration > 0 ? (t - p.startCtx + p.offset) % p.duration : 0,
        playing: !!p.source,
        stopping: p.stopping
      })),
      effects: this.effectLog.map((e) => ({ ...e })),
      music: this.personal.music,
      effectsVolume: this.personal.effects,
      muted: this.personal.muted,
      musicBus: this.musicBus.gain.value,
      effectsBus: this.effectsBus.gain.value
    }
  }
}

function set(param: AudioParam, value: number, t: number): void {
  param.cancelScheduledValues(t)
  param.setValueAtTime(value, t)
  param.value = value
}

function ramp(param: AudioParam, to: number, t: number, seconds: number): void {
  const from = param.value
  param.cancelScheduledValues(t)
  param.setValueAtTime(from, t)
  param.linearRampToValueAtTime(to, t + Math.max(0.001, seconds))
}
