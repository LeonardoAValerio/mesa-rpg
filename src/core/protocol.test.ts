import { describe, expect, it } from 'vitest'
import { parseClientMsg } from './protocol'

const H = 'a'.repeat(64)

describe('parseClientMsg (NET-15)', () => {
  it('returns null for text that is not JSON', () => {
    expect(parseClientMsg('{not json')).toBeNull()
    expect(parseClientMsg('')).toBeNull()
  })

  it('returns null for an unknown message type', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'hack', x: 1 }))).toBeNull()
  })

  it('returns null for an unknown action type', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'action', id: '1', action: { type: 'token/teleport', id: 'a' } }))).toBeNull()
  })

  it('returns null when a required field is missing or has the wrong type', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'action', id: '1', action: { type: 'token/move', id: 'a', col: 1 } }))).toBeNull()
    expect(parseClientMsg(JSON.stringify({ t: 'action', id: '1', action: { type: 'token/move', id: 'a', col: 1.5, row: 2 } }))).toBeNull()
    expect(parseClientMsg(JSON.stringify({ t: 'join' }))).toBeNull()
  })

  it('returns null for a hash that is not 64 hex characters', () => {
    const msg = { t: 'action', id: '1', action: { type: 'map/set', hash: '../etc/passwd', width: 10, height: 10 } }
    expect(parseClientMsg(JSON.stringify(msg))).toBeNull()
  })

  it('parses a well-formed join, action and ephemeral message', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'join', name: 'Ana' }))).toEqual({ t: 'join', name: 'Ana' })
    const place = { type: 'token/place', hash: H, name: 'goblin', faction: 'inimigo', size: 2, col: 3, row: 4 }
    expect(parseClientMsg(JSON.stringify({ t: 'action', id: '7', action: place }))).toEqual({ t: 'action', id: '7', action: place })
    expect(parseClientMsg(JSON.stringify({ t: 'ephemeral', e: { type: 'ping', x: 1, y: 2 } }))).toEqual({
      t: 'ephemeral',
      e: { type: 'ping', x: 1, y: 2 }
    })
  })
})
