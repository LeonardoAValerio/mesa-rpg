import { describe, expect, it } from 'vitest'
import { versionError } from './version'

describe('versionError', () => {
  it('VER-04 equal versions on both sides give no error', () => {
    expect(versionError('0.2.0', '0.2.0')).toBeNull()
  })

  it('VER-01 different versions give the message with both versions', () => {
    expect(versionError('0.2.0', '0.1.9')).toBe('Versão diferente da do mestre: mestre 0.2.0, você 0.1.9. Atualize o app.')
    expect(versionError('0.1.0', '0.10.0')).toBe('Versão diferente da do mestre: mestre 0.1.0, você 0.10.0. Atualize o app.')
  })

  it('VER-02 an absent player version is "desconhecida"', () => {
    expect(versionError('0.2.0', undefined)).toBe('Versão diferente da do mestre: mestre 0.2.0, você desconhecida. Atualize o app.')
  })

  it('VER-03 an absent master version is "desconhecida"', () => {
    expect(versionError(undefined, '0.2.0')).toBe('Versão diferente da do mestre: mestre desconhecida, você 0.2.0. Atualize o app.')
    expect(versionError(undefined, undefined)).toBe('Versão diferente da do mestre: mestre desconhecida, você desconhecida. Atualize o app.')
  })
})
