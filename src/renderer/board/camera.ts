export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 4

/** screen = world * scale + (x, y) */
export interface Camera {
  scale: number
  x: number
  y: number
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** MAP-07: zoom by `factor` keeping the world point under (sx, sy) fixed, within 10%..400%. */
export function zoomAt(c: Camera, sx: number, sy: number, factor: number): Camera {
  const scale = clamp(c.scale * factor, ZOOM_MIN, ZOOM_MAX)
  const wx = (sx - c.x) / c.scale
  const wy = (sy - c.y) / c.scale
  return { scale, x: sx - wx * scale, y: sy - wy * scale }
}

/** MAP-08 */
export function pan(c: Camera, dx: number, dy: number): Camera {
  return { ...c, x: c.x + dx, y: c.y + dy }
}

/** Fits a map inside the view, centred, without going past the zoom limits. */
export function fit(viewW: number, viewH: number, mapW: number, mapH: number): Camera {
  const scale = clamp(Math.min(viewW / mapW, viewH / mapH) * 0.95, ZOOM_MIN, ZOOM_MAX)
  return { scale, x: (viewW - mapW * scale) / 2, y: (viewH - mapH * scale) / 2 }
}

export function toWorld(c: Camera, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - c.x) / c.scale, y: (sy - c.y) / c.scale }
}
