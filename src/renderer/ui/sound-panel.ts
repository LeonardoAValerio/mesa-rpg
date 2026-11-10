import type { Action } from '../../core/protocol'
import type { Layer } from '../../core/sound'
import type { CampaignInfo, SoundEntry } from '../../preload/api'
import type { TableClient } from '../net/table-client'
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

type SoundSection = SoundEntry['section']
const SOUND_TITLES: Record<SoundSection, string> = { musicas: 'Músicas', efeitos: 'Efeitos' }

/**
 * SOM-01, SOM-02, SOM-04, SOM-06..11, SOM-16: the master's music and effects from the campaign (subfolders as groups,
 * "Adicionar arquivos"), a music click turning its layer on or off, an effect click playing it, the layers playing
 * with their volume, and "Parar tudo".
 */
export function masterSoundControls(client: TableClient): { root: HTMLElement; draw(info: CampaignInfo | null): void; destroy(): void } {
  let info: CampaignInfo | null = null
  const message = h('p', { class: 'error', testid: 'sound-message' })
  const show = async (action: Action): Promise<void> => {
    const r = await client.send(action)
    message.textContent = r.ok ? '' : r.reason // SOM-10: "Máximo de 8 camadas"
  }
  const live = (): Layer[] => (client.view?.sound.layers ?? []).filter((l) => l.stoppingAt === null)
  const nameOf = (hash: string): string => info?.sounds.find((s) => s.hash === hash)?.name ?? 'Arquivo fora da pasta'

  const sections = (['musicas', 'efeitos'] as const).map((section) => {
    const body = h('div', { class: 'campaign-list', testid: `list-${section}` })
    const open = new Map<string, boolean>()
    const row = (e: SoundEntry): HTMLElement => {
      const playing = section === 'musicas' && live().some((l) => l.hash === e.hash)
      return h('button', {
        class: 'campaign-row sound-row',
        testid: 'sound-item',
        title: e.path,
        'data-path': e.path,
        'data-playing': playing ? 'true' : 'false',
        onclick: () => void show(section === 'musicas' ? { type: 'sound/toggle', hash: e.hash } : { type: 'sound/effect', hash: e.hash })
      }, h('span', { class: 'sound-icon' }, section === 'musicas' ? (playing ? '■' : '▶') : '♪'), h('span', { testid: 'sound-name' }, e.name))
    }
    const draw = (): void => {
      const entries = (info?.sounds ?? []).filter((e) => e.section === section)
      const groups = new Map<string, SoundEntry[]>()
      for (const e of entries) groups.set(e.group, [...(groups.get(e.group) ?? []), e])
      const parts: HTMLElement[] = []
      for (const e of groups.get('') ?? []) parts.push(row(e))
      for (const [group, list] of [...groups].filter(([g]) => g !== '').sort(([a], [b]) => a.localeCompare(b))) {
        const details = h('details', { class: 'campaign-group', testid: `group-${section}-${group}` }, h('summary', {}, group), ...list.map(row))
        details.open = open.get(group) ?? true
        details.addEventListener('toggle', () => open.set(group, details.open))
        parts.push(details)
      }
      if (!parts.length) parts.push(h('p', { class: 'hint' }, 'Nada aqui ainda: ponha arquivos na pasta ou use "Adicionar arquivos".'))
      body.replaceChildren(...parts)
    }
    const added = h('p', { class: 'hint', testid: `add-message-${section}` })
    const add = h('button', {
      class: 'secondary',
      testid: `add-${section}`,
      onclick: async () => {
        const r = await window.mesa.addFiles(section)
        added.textContent = r.ok ? `Adicionados: ${r.added.map((p) => p.split('/').pop()).join(', ')}` : ''
      }
    }, 'Adicionar arquivos')
    return { root: h('section', { class: 'panel', testid: `section-${section}` }, h('h3', {}, SOUND_TITLES[section]), add, added, body), draw }
  })

  // SOM-08: the layers playing, each with its volume for everyone
  const playingList = h('div', { class: 'playing-list', testid: 'playing-list' })
  const sliders = new Map<string, HTMLInputElement>()
  const drawPlaying = (): void => {
    const layers = live()
    const rows = layers.map((l) => {
      let slider = sliders.get(l.hash)
      if (!slider) {
        const s = h('input', { type: 'range', min: 0, max: 100, step: 1, value: l.volume, testid: 'layer-volume' })
        s.addEventListener('input', () => void show({ type: 'sound/volume', hash: l.hash, volume: Number(s.value) }))
        slider = s
        sliders.set(l.hash, s)
      } else if (document.activeElement !== slider) slider.value = String(l.volume)
      return h('div', { class: 'layer-row', testid: 'layer', 'data-hash': l.hash }, h('span', { testid: 'layer-name' }, nameOf(l.hash)), slider)
    })
    for (const k of [...sliders.keys()]) if (!layers.some((l) => l.hash === k)) sliders.delete(k)
    playingList.replaceChildren(...(rows.length ? rows : [h('p', { class: 'hint' }, 'Nenhuma música tocando')]))
  }
  const stopAll = h('button', { class: 'secondary', testid: 'stop-all', onclick: () => void show({ type: 'sound/stopAll' }) }, 'Parar tudo')

  const drawAll = (): void => {
    for (const s of sections) s.draw()
    drawPlaying()
  }
  const off = client.on('view', drawAll)
  drawAll()
  // "Tocando" sits after the lists, held at the panel's foot: a layer starting never moves a row under the pointer
  const root = h('div', { class: 'sound-master' },
    ...sections.map((s) => s.root),
    h('section', { class: 'panel sound-playing', testid: 'section-playing' }, h('h3', {}, 'Tocando'), playingList, stopAll, message)
  )
  return {
    root,
    draw: (next) => {
      info = next
      drawAll()
    },
    destroy: off
  }
}
