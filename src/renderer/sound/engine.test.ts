import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FADE_MS, type Layer } from '../../core/sound'
import { SoundEngine, type AudioCtx } from './engine'

/** A Web Audio stand-in that records what the engine schedules, with a clock the test moves. */
class FakeParam {
  value = 1
  ramps: Array<{ to: number; at: number }> = []
  setValueAtTime(v: number): void {
    this.value = v
  }
  linearRampToValueAtTime(to: number, at: number): void {
    this.ramps.push({ to, at })
  }
  cancelScheduledValues(): void {}
}
class FakeNode {
  gain = new FakeParam()
  to: unknown[] = []
  fftSize = 32
  connect(target: unknown): void {
    this.to.push(target)
  }
  disconnect(): void {}
  getFloatTimeDomainData(a: Float32Array): void {
    a.fill(0)
  }
}
class FakeSource extends FakeNode {
  buffer: { duration: number } | null = null
  loop = false
  started: { when: number; offset?: number } | null = null
  stopped = false
  onended: (() => void) | null = null
  start(when = 0, offset?: number): void {
    this.started = { when, offset }
  }
  stop(): void {
    this.stopped = true
  }
}
function fakeCtx(): AudioCtx & { currentTime: number; sources: FakeSource[]; gains: FakeNode[] } {
  const sources: FakeSource[] = []
  const gains: FakeNode[] = []
  return {
    currentTime: 100,
    destination: {} as AudioDestinationNode,
    sources,
    gains,
    createGain: () => {
      const g = new FakeNode()
      gains.push(g)
      return g as unknown as GainNode
    },
    createAnalyser: () => new FakeNode() as unknown as AnalyserNode,
    createBufferSource: () => {
      const s = new FakeSource()
      sources.push(s)
      return s as unknown as AudioBufferSourceNode
    },
    decodeAudioData: async (b: ArrayBuffer) => ({ duration: new Uint8Array(b)[0] }) as unknown as AudioBuffer,
    close: async () => {}
  } as never
}

const RAIN = 'a'.repeat(64)
const SWORD = 'b'.repeat(64)
let clock = 1_000_000
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0))
const layer = (extra: Partial<Layer> = {}): Layer => ({ hash: RAIN, volume: 100, startedAt: clock, stoppingAt: null, ...extra })

function engine(load: (h: string) => Promise<Uint8Array | null> = async () => new Uint8Array([30])): { e: SoundEngine; ctx: ReturnType<typeof fakeCtx> } {
  const ctx = fakeCtx()
  return { e: new SoundEngine({ ctx, load, serverNow: () => clock }), ctx }
}

beforeEach(() => {
  clock = 1_000_000
})
afterEach(() => vi.useRealTimers())

describe('SoundEngine', () => {
  it('SOM-06 a new layer loops from the start and rises from 0 to its volume over 2 s', async () => {
    const { e, ctx } = engine()
    e.setLayers([layer({ volume: 60 })])
    await settle()
    const src = ctx.sources[0]
    expect(src.loop).toBe(true)
    expect(src.started).toEqual({ when: 0, offset: 0 })
    const g = ctx.gains[2].gain // after the two buses
    expect(g.value).toBe(0)
    expect(g.ramps).toEqual([{ to: 0.6, at: 100 + FADE_MS / 1000 }])
  })

  it('SOM-12 a layer already playing when the window joins starts at the table\'s point, with no rise', async () => {
    const { e, ctx } = engine() // 30-second file
    e.setLayers([layer({ startedAt: clock - 72_500 })]) // 2 loops and 12.5 s in
    await settle()
    expect(ctx.sources[0].started).toEqual({ when: 0, offset: 12.5 })
    expect(ctx.gains[2].gain.value).toBe(1)
    expect(ctx.gains[2].gain.ramps).toEqual([])
  })

  it('[C14] SOM-14 a layer whose file arrives late starts from the table\'s point when it arrives', async () => {
    let arrive: (b: Uint8Array) => void = () => {}
    const { e, ctx } = engine(() => new Promise((r) => (arrive = r)))
    e.setLayers([layer()])
    clock += 9000 // the download takes 9 s
    arrive(new Uint8Array([30]))
    await settle()
    expect(ctx.sources[0].started).toEqual({ when: 0, offset: 9 })
    expect(ctx.gains[2].gain.value).toBe(1) // past the rise: at its volume
    expect(e.snapshot().layers[0]).toMatchObject({ hash: RAIN, playing: true, position: 9 })
  })

  it('SOM-07 a layer turned off fades to 0 over 2 s, then stops', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { e, ctx } = engine()
    e.setLayers([layer({ startedAt: clock - 60_000 })])
    await vi.advanceTimersByTimeAsync(0)
    e.setLayers([layer({ startedAt: clock - 60_000, stoppingAt: clock })])
    expect(ctx.gains[2].gain.ramps.at(-1)).toEqual({ to: 0, at: 100 + 2 })
    expect(ctx.sources[0].stopped).toBe(false)
    await vi.advanceTimersByTimeAsync(FADE_MS)
    expect(ctx.sources[0].stopped).toBe(true)
    expect(e.snapshot().layers).toEqual([])
  })

  it('a layer clicked again while fading out rises back and is not stopped', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const { e, ctx } = engine()
    e.setLayers([layer({ startedAt: clock - 60_000 })])
    await vi.advanceTimersByTimeAsync(0)
    e.setLayers([layer({ startedAt: clock - 60_000, stoppingAt: clock })])
    e.setLayers([layer({ startedAt: clock - 60_000 })])
    expect(ctx.gains[2].gain.ramps.at(-1)).toEqual({ to: 1, at: 102 })
    await vi.advanceTimersByTimeAsync(FADE_MS + 100)
    expect(ctx.sources[0].stopped).toBe(false)
  })

  it('SOM-09 a new layer volume is reached within 1 s', async () => {
    const { e, ctx } = engine()
    e.setLayers([layer({ startedAt: clock - 60_000 })])
    await settle()
    e.setLayers([layer({ startedAt: clock - 60_000, volume: 30 })])
    const last = ctx.gains[2].gain.ramps.at(-1)!
    expect(last.to).toBeCloseTo(0.3)
    expect(last.at - 100).toBeLessThanOrEqual(1)
  })

  it('a layer gone from the table stops at once; one never started is not started late', async () => {
    let arrive: (b: Uint8Array) => void = () => {}
    const { e, ctx } = engine(() => new Promise((r) => (arrive = r)))
    e.setLayers([layer()])
    e.setLayers([])
    arrive(new Uint8Array([30]))
    await settle()
    expect(ctx.sources).toHaveLength(0)
  })

  it('[C18] SOM-18 an effect arriving more than 2 s after the click is skipped; one on time plays once', async () => {
    let arrive: (b: Uint8Array) => void = () => {}
    const { e, ctx } = engine(() => new Promise((r) => (arrive = r)))
    const late = e.playEffect(SWORD, clock)
    clock += 2001
    arrive(new Uint8Array([2]))
    await late
    expect(ctx.sources).toHaveLength(0)
    await e.playEffect(SWORD, clock - 2000) // the file is here now; exactly 2 s after the click still plays
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0].started).toEqual({ when: 0, offset: undefined })
    expect(ctx.sources[0].loop).toBe(false)
    expect(e.snapshot().effects.map((x) => x.played)).toEqual([false, true])
  })

  it('SOM-16 the same effect twice plays twice, overlapping: the first is not cut', async () => {
    const { e, ctx } = engine()
    await Promise.all([e.playEffect(SWORD, clock), e.playEffect(SWORD, clock)])
    expect(ctx.sources.filter((s) => s.started)).toHaveLength(2)
    expect(ctx.sources.some((s) => s.stopped)).toBe(false)
    expect(e.snapshot().effectsPlaying).toBe(2)
    ctx.sources[0].onended?.()
    expect(e.snapshot().effectsPlaying).toBe(1)
  })

  it('SOM-21, SOM-22 layers go through the music bus and effects through the effects bus, each bus to the speakers through its meter', async () => {
    const { e, ctx } = engine()
    const [music, effects] = ctx.gains
    e.setLayers([layer()])
    await e.playEffect(SWORD, clock)
    expect(ctx.gains[2].to).toEqual([music]) // the layer's gain
    expect(ctx.sources[0].to).toEqual([ctx.gains[2]])
    expect(ctx.sources[1].to).toEqual([effects]) // the effect
    expect((music.to[0] as FakeNode).to).toEqual([ctx.destination])
    expect((effects.to[0] as FakeNode).to).toEqual([ctx.destination])
    expect(music.to[0]).not.toBe(effects.to[0])
  })

  it('a layer turned off before its file came, and clicked again during the fade, rises once the file is here', async () => {
    let arrive: (b: Uint8Array) => void = () => {}
    const { e, ctx } = engine(() => new Promise((r) => (arrive = r)))
    const start = clock - 60_000
    e.setLayers([layer({ startedAt: start })])
    e.setLayers([layer({ startedAt: start, stoppingAt: clock })])
    arrive(new Uint8Array([30])) // the file arrives during the fade
    await settle()
    e.setLayers([layer({ startedAt: start })]) // clicked again
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0].stopped).toBe(false)
    expect(ctx.gains[2].gain.ramps.at(-1)).toEqual({ to: 1, at: 102 })
    expect(e.snapshot().layers[0]).toMatchObject({ playing: true, stopping: false })
  })

  it('SOM-20..23 the buses follow "Música", "Efeitos" and "Mudo", starting at 80', () => {
    const { e, ctx } = engine()
    const [music, effects] = ctx.gains
    expect([music.gain.value, effects.gain.value]).toEqual([0.8, 0.8])
    e.setPersonal({ music: 20, effects: 50, muted: false })
    expect([music.gain.value, effects.gain.value]).toEqual([0.2, 0.5])
    e.setPersonal({ music: 20, effects: 50, muted: true })
    expect([music.gain.value, effects.gain.value]).toEqual([0, 0])
    e.setPersonal({ music: 20, effects: 50, muted: false })
    expect([music.gain.value, effects.gain.value]).toEqual([0.2, 0.5])
  })

  it('SOM-15 stopAll stops every layer', async () => {
    const { e, ctx } = engine()
    e.setLayers([layer(), layer({ hash: SWORD })])
    await settle()
    e.stopAll()
    expect(ctx.sources.every((s) => s.stopped)).toBe(true)
    expect(e.snapshot().layers).toEqual([])
  })
})
