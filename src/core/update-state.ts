/** What the updater reported; `version` is the release on offer (absent on progress, not-available and error). */
export interface UpdateEvent {
  kind: 'available' | 'progress' | 'downloaded' | 'not-available' | 'error'
  version?: string
}

export interface UpdateState {
  phase: 'idle' | 'downloading' | 'ready'
  version?: string
}

export const IDLE: UpdateState = { phase: 'idle' }

/** UPD-04, UPD-05, UPD-11, UPD-12: the update's state after one updater event. */
export function reduceUpdate(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.kind) {
    case 'available':
      return event.version ? { phase: 'downloading', version: event.version } : state
    case 'progress':
      if (state.phase === 'ready') return state
      return state.version ? { phase: 'downloading', version: state.version } : state
    case 'downloaded': {
      const version = event.version ?? state.version
      return version ? { phase: 'ready', version } : state
    }
    case 'error':
      // A failure after the download (e.g. a later check) leaves the file on disk, still installable on quit.
      return state.phase === 'ready' ? state : IDLE
    case 'not-available':
      return IDLE
  }
}

export interface UpdateBanner {
  text: string
  /** True when "Reiniciar e atualizar" is offered. */
  install: boolean
}

/** The top bar's text, or null when nothing is shown. */
export function updateBanner(state: UpdateState): UpdateBanner | null {
  if (state.phase === 'downloading') return { text: `Baixando atualização ${state.version}…`, install: false }
  if (state.phase === 'ready') return { text: `Atualização ${state.version} pronta`, install: true }
  return null
}
