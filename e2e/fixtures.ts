import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'

const dir = mkdtempSync(join(tmpdir(), 'mesa-fixtures-'))

/** A map PNG with a cols x rows grid of dark lines over a textured background. */
export function gridMap(name: string, w: number, h: number, cols: number, rows: number): string {
  const png = new PNG({ width: w, height: h })
  let seed = 7
  const rnd = (): number => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32)
  const cw = w / cols
  const ch = h / rows
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 120 + rnd() * 40 + 30 * Math.sin(x / 170) * Math.cos(y / 130)
      if (cols > 1 && (x % cw < 2 || y % ch < 2)) v *= 0.35
      const i = (y * w + x) * 4
      png.data[i] = v * 0.8
      png.data[i + 1] = v
      png.data[i + 2] = v * 0.6
      png.data[i + 3] = 255
    }
  }
  const path = join(dir, name)
  writeFileSync(path, PNG.sync.write(png))
  return path
}

export function textFile(name: string, content: string): string {
  const path = join(dir, name)
  writeFileSync(path, content)
  return path
}

/** A folder as the Blender kit writes it: PNGs, and optional JSON manifests beside them. */
export function tokenFolder(name: string, files: Record<string, Buffer | string>): string {
  const path = join(dir, name)
  mkdirSync(path, { recursive: true })
  for (const [file, content] of Object.entries(files)) writeFileSync(join(path, file), content)
  return path
}

/** A mono 8 kHz 16-bit WAV of `seconds` with a quiet tone, as a campaign music or effect file. */
export function toneWav(seconds: number, hz = 440): Buffer {
  const rate = 8000
  const n = Math.round(seconds * rate)
  const b = Buffer.alloc(44 + n * 2)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(36 + n * 2, 4)
  b.write('WAVEfmt ', 8, 'latin1')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20) // PCM
  b.writeUInt16LE(1, 22) // mono
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 2, 28)
  b.writeUInt16LE(2, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36, 'latin1')
  b.writeUInt32LE(n * 2, 40)
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * hz * i) / rate) * 3000), 44 + i * 2)
  return b
}
