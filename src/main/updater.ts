// The auto-updater (UPD-03, UPD-09, UPD-10, UPD-12, UPD-13). No Electron import here: main passes in
// electron-updater's `autoUpdater`, and tests pass a fake with the same events.
import { EventEmitter } from 'node:events'
import { IDLE, reduceUpdate, type UpdateEvent, type UpdateState } from '../core/update-state'

/** The part of electron-updater's `autoUpdater` this app uses. */
export interface Updater {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  on(event: string, listener: (info?: unknown) => void): unknown
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdaterOptions {
  isPackaged: boolean
  updater: Updater
  onState(state: UpdateState): void
  /** Ends the hosted table, if any, so players see "O mestre encerrou a mesa" (UPD-08). */
  stopServer(): Promise<void>
}

export interface UpdaterHandle {
  state(): UpdateState
  install(): Promise<void>
}

export function startUpdater(opts: UpdaterOptions): UpdaterHandle {
  let state: UpdateState = IDLE
  const handle: UpdaterHandle = {
    state: () => state,
    install: async () => {
      if (state.phase !== 'ready') return
      await opts.stopServer()
      opts.updater.quitAndInstall(false, true)
    }
  }
  if (!opts.isPackaged) return handle // UPD-13: `npm run dev` and tests never ask GitHub

  const { updater } = opts
  updater.autoDownload = true
  updater.autoInstallOnAppQuit = true // UPD-09
  const feed = (event: UpdateEvent): void => {
    state = reduceUpdate(state, event)
    opts.onState(state)
  }
  const versionOf = (info: unknown): string | undefined => {
    const v = (info as { version?: unknown } | undefined)?.version
    return typeof v === 'string' ? v : undefined
  }
  // UPD-10: no listener installs; only install() does, from the user's click.
  updater.on('update-available', (info) => feed({ kind: 'available', version: versionOf(info) }))
  updater.on('download-progress', () => feed({ kind: 'progress' }))
  updater.on('update-downloaded', (info) => feed({ kind: 'downloaded', version: versionOf(info) }))
  updater.on('update-not-available', () => feed({ kind: 'not-available' }))
  updater.on('error', () => feed({ kind: 'error' }))
  updater.checkForUpdates().catch(() => feed({ kind: 'error' })) // UPD-12: offline is fine
  return handle
}

/** Stands in for electron-updater under MESA_TEST; tests emit its events and read what it was asked. */
export class FakeUpdater extends EventEmitter implements Updater {
  autoDownload = false
  autoInstallOnAppQuit = false
  checks = 0
  installs: Array<[boolean | undefined, boolean | undefined]> = []
  /** When set, the next checkForUpdates rejects with it, as electron-updater does offline. */
  failCheck: Error | null = null

  checkForUpdates(): Promise<unknown> {
    this.checks++
    return this.failCheck ? Promise.reject(this.failCheck) : Promise.resolve(null)
  }

  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.installs.push([isSilent, isForceRunAfter])
  }
}
