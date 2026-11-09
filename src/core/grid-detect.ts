import { clampGrid } from './grid'
import type { Grid } from './types'

export const PERIOD_MIN = 20
export const PERIOD_MAX = 400
export const FALLBACK_CELL = 70
export const GRID_NOT_DETECTED = 'Grid não detectado — ajuste manualmente'

const FFT_SIZE = 16384 // zero padding: ~0.2 px resolution around an 83 px period
const HIGH_PASS = 7 // half window: grid lines are thin, terrain shading is wide

/** Removes slow brightness changes (terrain, light) so only sharp lines remain. */
function highPass(profile: Float64Array): Float64Array {
  const n = profile.length
  const prefix = new Float64Array(n + 1)
  for (let i = 0; i < n; i++) prefix[i + 1] = prefix[i] + profile[i]
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - HIGH_PASS)
    const b = Math.min(n, i + HIGH_PASS + 1)
    out[i] = profile[i] - (prefix[b] - prefix[a]) / (b - a)
  }
  return out
}

export interface Detection {
  cell: number
  offsetX: number
  offsetY: number
}

/** In-place iterative radix-2 FFT. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1
      let ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k
        const b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr
        im[b] = im[a] - ti
        re[a] += tr
        im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr
        cr = ncr
      }
    }
  }
}

/** The grid period of a brightness profile, or null when no clear periodic peak exists. */
export function detectPeriod(raw: Float64Array): number | null {
  const n = raw.length
  if (n < PERIOD_MIN * 3) return null
  const profile = highPass(raw)
  let size = FFT_SIZE
  while (size < 2 * n) size *= 2
  const re = new Float64Array(size)
  const im = new Float64Array(size)
  re.set(profile)
  fft(re, im)
  // Autocorrelation = inverse FFT of the power spectrum (forward FFT of a real, even signal, scaled).
  for (let k = 0; k < size; k++) {
    re[k] = re[k] * re[k] + im[k] * im[k]
    im[k] = 0
  }
  fft(re, im)
  const maxLag = Math.min(PERIOD_MAX, Math.floor(n / 2))
  const acf = (lag: number): number => re[lag] / (n - lag)
  const zero = acf(0)
  if (zero <= 0) return null

  // A comb of lines correlates at p, 2p, 3p... and not at p/2: the first strong peak is the cell.
  let best = 0
  for (let lag = PERIOD_MIN; lag <= maxLag; lag++) best = Math.max(best, acf(lag))
  if (best < 0.3 * zero) return null
  const peakNear = (lag: number, radius: number): number | null => {
    let at = -1
    let v = -Infinity
    for (let l = Math.max(1, Math.round(lag - radius)); l <= Math.min(n - 2, Math.round(lag + radius)); l++) {
      if (acf(l) > v) {
        v = acf(l)
        at = l
      }
    }
    if (at < 0) return null
    const a = acf(at - 1)
    const c = acf(at + 1)
    const denom = a - 2 * v + c
    return at + (denom === 0 ? 0 : (0.5 * (a - c)) / denom)
  }
  for (let lag = PERIOD_MIN; lag <= maxLag; lag++) {
    const v = acf(lag)
    if (v < 0.6 * best || v < acf(lag - 1) || v < acf(lag + 1)) continue
    const first = peakNear(lag, 1)
    if (first === null) return null
    // MAP-04: a strong peak at a fraction of this lag below PERIOD_MIN means the real period is under 20 px.
    for (let k = 2; first / k >= 3; k++) {
      const sub = first / k
      if (sub >= PERIOD_MIN) continue
      const l = Math.round(sub)
      const peak = Math.max(acf(l - 1), acf(l), acf(l + 1))
      if (peak >= 0.6 * best) return null
    }
    // Refine on the farthest multiple that still fits: the error divides by the multiple.
    const m = Math.max(1, Math.floor((n / 2) / first))
    const far = peakNear(first * m, Math.max(2, m))
    return far === null ? first : far / m
  }
  return null
}

/** Where the lines sit inside one period: the phase with the largest deviation from the mean. */
function phaseOf(profile: Float64Array, period: number): number {
  const bins = Math.max(1, Math.round(period))
  const sum = new Float64Array(bins)
  const count = new Float64Array(bins)
  let mean = 0
  for (const v of profile) mean += v
  mean /= profile.length
  for (let x = 0; x < profile.length; x++) {
    const b = Math.floor(((x % period) / period) * bins) % bins
    sum[b] += profile[x]
    count[b]++
  }
  let best = 0
  let bestDev = -1
  for (let b = 0; b < bins; b++) {
    const dev = count[b] ? Math.abs(sum[b] / count[b] - mean) : 0
    if (dev > bestDev) {
      bestDev = dev
      best = b
    }
  }
  return ((best + 0.5) / bins) * period
}

/** MAP-03: grid cell and offset from mean brightness per column and per row, via FFT. */
export function detectGrid(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Detection | null {
  const cols = new Float64Array(width)
  const rows = new Float64Array(height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const l = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]
      cols[x] += l
      rows[y] += l
    }
  }
  for (let x = 0; x < width; x++) cols[x] /= height
  for (let y = 0; y < height; y++) rows[y] /= width

  const px = detectPeriod(cols)
  const py = detectPeriod(rows)
  const hx = highPass(cols)
  const hy = highPass(rows)
  const cell = px && py ? (Math.abs(px - py) / Math.max(px, py) < 0.05 ? (px + py) / 2 : null) : (px ?? py)
  if (!cell) return null
  return { cell, offsetX: phaseOf(hx, cell) % cell, offsetY: phaseOf(hy, cell) % cell }
}

/** MAP-04: a failed detection falls back to a 70 px cell and a warning for the master. */
export function gridFromDetection(det: Detection | null, base?: Grid): { grid: Grid; warning: string | null } {
  if (!det) return { grid: clampGrid({ cell: FALLBACK_CELL, offsetX: 0, offsetY: 0 }, base), warning: GRID_NOT_DETECTED }
  const cell = Math.round(det.cell * 100) / 100
  return {
    grid: clampGrid({ cell, offsetX: Math.round(det.offsetX * 100) / 100, offsetY: Math.round(det.offsetY * 100) / 100 }, base),
    warning: null
  }
}
