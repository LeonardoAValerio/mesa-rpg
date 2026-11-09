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
