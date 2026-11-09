import { describe, expect, it } from 'vitest'
import type { UpdateState } from '../core/update-state'
import { FakeUpdater, startUpdater } from './updater'

function setup(isPackaged: boolean, fail?: Error) {
  const updater = new FakeUpdater()
  if (fail) updater.failCheck = fail
  const states: UpdateState[] = []
  const calls: string[] = []
  const origInstall = updater.quitAndInstall.bind(updater)
  updater.quitAndInstall = (s, r) => {
    calls.push('quitAndInstall')
    origInstall(s, r)
  }
  const handle = startUpdater({
    isPackaged,
    updater,
    onState: (s) => states.push(s),
    stopServer: async () => {
      await new Promise((r) => setTimeout(r, 5)) // the real close is async; install must wait for it
      calls.push('stopServer')
    }
  })
  return { updater, states, calls, handle }
}

/** The events electron-updater emits for a release that downloads fine. */
function downloadSequence(u: FakeUpdater): void {
  u.emit('update-available', { version: '0.2.0' })
  u.emit('download-progress', { percent: 10 })
  u.emit('download-progress', { percent: 100 })
  u.emit('update-downloaded', { version: '0.2.0' })
}

describe('startUpdater', () => {
  it('UPD-13 unpackaged, the updater never checks for updates and ignores its events', () => {
    const { updater, states } = setup(false)
    expect(updater.checks).toBe(0)
    downloadSequence(updater)
    expect(states).toEqual([])
    expect(updater.installs).toEqual([])
  })

  it('[C3] UPD-03 packaged, the updater checks the latest release once on start and downloads on its own', () => {
    const { updater } = setup(true)
    expect(updater.checks).toBe(1)
    expect(updater.autoDownload).toBe(true)
  })

  it('[C9] UPD-09 a downloaded update installs on quit: autoInstallOnAppQuit is on', () => {
    const { updater, handle } = setup(true)
    downloadSequence(updater)
    expect(handle.state()).toEqual({ phase: 'ready', version: '0.2.0' })
    expect(updater.autoInstallOnAppQuit).toBe(true)
  })

  it('[C10] UPD-10 no updater event calls quitAndInstall; install() stops the server first, then quitAndInstall(false, true)', async () => {
    const { updater, states } = setup(true)
    downloadSequence(updater)
    updater.emit('update-not-available', { version: '0.2.0' })
    updater.emit('error', new Error('later failure'))
    await new Promise((r) => setTimeout(r, 20))
    expect(updater.installs).toEqual([])
    expect(states.map((s) => s.phase)).toEqual(['downloading', 'downloading', 'downloading', 'ready', 'idle', 'idle'])

    const again = setup(true)
    downloadSequence(again.updater)
    await again.handle.install()
    expect(again.calls).toEqual(['stopServer', 'quitAndInstall'])
    expect(again.updater.installs).toEqual([[false, true]])
  })

  it('[C12] UPD-12 a rejected checkForUpdates does not throw and leaves nothing to show', async () => {
    const unhandled: unknown[] = []
    const onUnhandled = (e: unknown): void => void unhandled.push(e)
    process.on('unhandledRejection', onUnhandled)
    try {
      const { states, handle } = setup(true, new Error('net::ERR_INTERNET_DISCONNECTED'))
      await new Promise((r) => setTimeout(r, 20))
      expect(unhandled).toEqual([])
      expect(handle.state()).toEqual({ phase: 'idle' })
      expect(states.every((s) => s.phase === 'idle')).toBe(true)
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  it('UPD-04 the state pushed while downloading names the version on offer', () => {
    const { updater, states } = setup(true)
    updater.emit('update-available', { version: '0.3.1' })
    expect(states.at(-1)).toEqual({ phase: 'downloading', version: '0.3.1' })
  })
})
