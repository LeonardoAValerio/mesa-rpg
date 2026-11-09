export const EPHEMERAL_MAX = 30
export const EPHEMERAL_WINDOW_MS = 10_000

/** Sliding window: at most `max` events in any `windowMs` (TOOL-05). */
export function createLimiter(max = EPHEMERAL_MAX, windowMs = EPHEMERAL_WINDOW_MS): { allow(now: number): boolean } {
  const times: number[] = []
  return {
    allow(now) {
      while (times.length && now - times[0] >= windowMs) times.shift()
      if (times.length >= max) return false
      times.push(now)
      return true
    }
  }
}
