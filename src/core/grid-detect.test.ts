import { describe, expect, it } from 'vitest'
import { detectGrid, gridFromDetection } from './grid-detect'

/** Deterministic pseudo-random numbers so the fixtures are the same on every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

/** A painted-looking map: textured terrain with soft blobs, optionally with grid lines drawn over it. */
function mapImage(w: number, h: number, cols: number, rows: number, withGrid: boolean, seed = 1): Uint8ClampedArray {
  const r = rng(seed)
  const img = new Uint8ClampedArray(w * h * 4)
  const blobs = Array.from({ length: 8 }, () => ({ x: r() * w, y: r() * h, rad: 60 + r() * 300, v: r() * 120 - 60 }))
  const cw = w / cols
  const ch = h / rows
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 110 + r() * 50
      for (const b of blobs) {
        const d = Math.hypot(x - b.x, y - b.y)
        if (d < b.rad) v += b.v * (1 - d / b.rad)
      }
      if (withGrid) {
        const onV = x % cw < 2
        const onH = y % ch < 2
        if (onV || onH) v = v * 0.35
      }
      const i = (y * w + x) * 4
      img[i] = v * 0.9
      img[i + 1] = v
      img[i + 2] = v * 0.7
      img[i + 3] = 255
    }
  }
  return img
}

describe('detectGrid', () => {
  it('[C19] MAP-03 detects a 2000x1500 map with a 24x18 grid as a cell between 82 and 85 px', () => {
    const det = detectGrid(mapImage(2000, 1500, 24, 18, true), 2000, 1500)
    expect(det).not.toBeNull()
    expect(det!.cell).toBeGreaterThanOrEqual(82)
    expect(det!.cell).toBeLessThanOrEqual(85)
    // lines are drawn at x = 0, 83.3, 166.7...: the offset lands on a line (within 3 px, modulo the cell)
    const off = (v: number): number => Math.min(v, det!.cell - v)
    expect(off(det!.offsetX)).toBeLessThan(3)
    expect(off(det!.offsetY)).toBeLessThan(3)
  })

  it('finds the offset of a grid that does not start at the edge', () => {
    const w = 1200
    const h = 900
    const base = mapImage(w + 30, h + 40, 1, 1, false, 7)
    const img = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const si = (y * (w + 30) + x) * 4
        const di = (y * w + x) * 4
        const line = (x - 30 + 1000 * 60) % 60 < 2 || (y - 40 + 1000 * 60) % 60 < 2
        for (let c = 0; c < 3; c++) img[di + c] = line ? base[si + c] * 0.3 : base[si + c]
        img[di + 3] = 255
      }
    }
    const det = detectGrid(img, w, h)!
    expect(det.cell).toBeGreaterThan(59)
    expect(det.cell).toBeLessThan(61)
    expect(Math.abs(det.offsetX - 31)).toBeLessThan(3)
    expect(Math.abs(det.offsetY - 41)).toBeLessThan(3)
  })

  it('[C20] MAP-04 an image with no grid falls back to a 70 px cell and "Grid não detectado — ajuste manualmente"', () => {
    const det = detectGrid(mapImage(1000, 750, 1, 1, false, 3), 1000, 750)
    expect(det).toBeNull()
    const { grid, warning } = gridFromDetection(det)
    expect(grid.cell).toBe(70)
    expect(warning).toBe('Grid não detectado — ajuste manualmente')
  })

  it('a detected grid produces no warning', () => {
    const { grid, warning } = gridFromDetection({ cell: 83.33, offsetX: 1, offsetY: 1 })
    expect(warning).toBeNull()
    expect(grid.cell).toBe(83.33)
  })
})
