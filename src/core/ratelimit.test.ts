import { describe, expect, it } from 'vitest'
import { createLimiter } from './ratelimit'

describe('createLimiter', () => {
  it('allows 30 events in 10 s and frees a slot when the oldest is 10 s old', () => {
    const l = createLimiter()
    for (let i = 0; i < 30; i++) expect(l.allow(i * 10)).toBe(true)
    expect(l.allow(9_999)).toBe(false)
    expect(l.allow(10_000)).toBe(true) // the event at t=0 left the window
    expect(l.allow(10_001)).toBe(false)
  })
})
