import { DEFAULT_PERSONAL, type Personal } from '../sound/engine'
import { h } from './dom'

/** SOM-24: this computer's own volumes. */
export const PERSONAL_KEY = 'mesa-sound-v1'

export function loadPersonal(): Personal {
  try {
    const raw = JSON.parse(localStorage.getItem(PERSONAL_KEY) ?? 'null') as Partial<Personal> | null
    const vol = (v: unknown, d: number): number => (typeof v === 'number' && v >= 0 && v <= 100 ? v : d)
    return { music: vol(raw?.music, DEFAULT_PERSONAL.music), effects: vol(raw?.effects, DEFAULT_PERSONAL.effects), muted: raw?.muted === true }
  } catch {
    return { ...DEFAULT_PERSONAL }
  }
}

function savePersonal(p: Personal): void {
  try {
    localStorage.setItem(PERSONAL_KEY, JSON.stringify(p))
  } catch {
    // storage blocked: the volumes hold for this session
  }
}

/** SOM-20..24: "Música", "Efeitos" (0..100) and "Mudo", only for this window, kept on this computer. */
export function personalControls(onChange: (p: Personal) => void): HTMLElement {
  let p = loadPersonal()
  const slider = (testid: string, value: number): HTMLInputElement => h('input', { type: 'range', min: 0, max: 100, step: 1, value, testid })
  const music = slider('sound-music', p.music)
  const effects = slider('sound-effects', p.effects)
  const mute = h('input', { type: 'checkbox', testid: 'sound-mute' })
  mute.checked = p.muted
  const update = (): void => {
    p = { music: Number(music.value), effects: Number(effects.value), muted: mute.checked }
    savePersonal(p)
    onChange(p)
  }
  for (const el of [music, effects]) el.addEventListener('input', update)
  mute.addEventListener('change', update)
  onChange(p)
  return h('section', { class: 'panel sound-personal', testid: 'sound-personal' },
    h('h3', {}, 'Meu volume'),
    h('label', {}, 'Música', music),
    h('label', {}, 'Efeitos', effects),
    h('label', { class: 'check' }, mute, 'Mudo')
  )
}
