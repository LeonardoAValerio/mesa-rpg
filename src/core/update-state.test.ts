import { describe, expect, it } from 'vitest'
import { IDLE, reduceUpdate, updateBanner, type UpdateEvent, type UpdateState } from './update-state'

const run = (events: UpdateEvent[], from: UpdateState = IDLE): UpdateState => events.reduce(reduceUpdate, from)

describe('update state', () => {
  it('UPD-04 a newer version being downloaded shows "Baixando atualização <versão>…", also during progress', () => {
    const available = run([{ kind: 'available', version: '0.2.0' }])
    expect(updateBanner(available)).toEqual({ text: 'Baixando atualização 0.2.0…', install: false })
    const progress = run([{ kind: 'progress' }, { kind: 'progress' }], available)
    expect(updateBanner(progress)).toEqual({ text: 'Baixando atualização 0.2.0…', install: false })
  })

  it('UPD-05 a finished download shows "Atualização <versão> pronta" with the install button', () => {
    const ready = run([{ kind: 'available', version: '0.2.0' }, { kind: 'progress' }, { kind: 'downloaded', version: '0.2.0' }])
    expect(ready).toEqual({ phase: 'ready', version: '0.2.0' })
    expect(updateBanner(ready)).toEqual({ text: 'Atualização 0.2.0 pronta', install: true })
    // A late progress event does not take the button away.
    expect(updateBanner(run([{ kind: 'progress' }], ready))).toEqual({ text: 'Atualização 0.2.0 pronta', install: true })
  })

  it('UPD-11 the same or an older release shows nothing', () => {
    expect(updateBanner(run([{ kind: 'not-available', version: '0.1.0' }]))).toBeNull()
    expect(updateBanner(IDLE)).toBeNull()
  })

  it('UPD-12 a failed check or a failed download shows nothing', () => {
    expect(updateBanner(run([{ kind: 'error' }]))).toBeNull()
    const failedDownload = run([{ kind: 'available', version: '0.2.0' }, { kind: 'progress' }, { kind: 'error' }])
    expect(failedDownload).toEqual(IDLE)
    expect(updateBanner(failedDownload)).toBeNull()
    // Progress without a known version (no "available" seen) has nothing to say.
    expect(updateBanner(run([{ kind: 'progress' }]))).toBeNull()
  })

  it('UPD-09 an error after the download keeps the update ready: the file is already on disk', () => {
    const ready = run([{ kind: 'available', version: '0.2.0' }, { kind: 'downloaded', version: '0.2.0' }, { kind: 'error' }])
    expect(updateBanner(ready)).toEqual({ text: 'Atualização 0.2.0 pronta', install: true })
  })
})
