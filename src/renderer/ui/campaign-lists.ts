import type { CampaignEntry, CampaignInfo } from '../../preload/api'
import type { LibraryItem } from '../../core/types'
import { decodeImage } from '../assets/textures'
import { h } from './dom'
import { DRAG_TYPE } from './library'

type Section = CampaignEntry['section']
const TITLES: Record<Section, string> = { mapas: 'Mapas da campanha', tokens: 'Tokens', objetos: 'Objetos' }
const THUMB = 48

const bitmaps = new Map<string, Promise<ImageBitmap | null>>()
/** A 48 px thumbnail drawn on a canvas: the CSP allows no data: or blob: images (CAMP-08, CAMP-09). */
function thumbnail(hash: string): HTMLCanvasElement {
  const canvas = h('canvas', { class: 'thumb', testid: 'thumb', width: THUMB, height: THUMB })
  let p = bitmaps.get(hash)
  if (!p) {
    p = window.mesa.assetBytes(hash).then((b) => (b ? decodeImage(b) : null))
    bitmaps.set(hash, p)
  }
  void p.then((bmp) => {
    const ctx = canvas.getContext('2d')
    if (!bmp || !ctx) return
    const k = Math.min(THUMB / bmp.width, THUMB / bmp.height)
    const w = bmp.width * k
    const hgt = bmp.height * k
    ctx.drawImage(bmp, (THUMB - w) / 2, (THUMB - hgt) / 2, w, hgt)
    canvas.dataset.drawn = 'true'
  })
  return canvas
}

/**
 * CAMP-08..14: one section of the campaign (mapas, tokens or objetos) as a list with thumbnails, its subfolders as
 * groups that open and close, and "Adicionar arquivos". Tokens and objects drag onto the map; a map loads on click.
 */
export function campaignSection(section: Section, onMap?: (e: CampaignEntry) => void): { root: HTMLElement; draw(info: CampaignInfo | null): void } {
  const body = h('div', { class: 'campaign-list', testid: `list-${section}` })
  const open = new Map<string, boolean>() // a group the master closed stays closed across updates
  const row = (e: CampaignEntry): HTMLElement => {
    if (section === 'mapas') {
      return h('button', { class: 'campaign-row', testid: 'map-item', title: e.path, 'data-path': e.path, onclick: () => onMap?.(e) }, thumbnail(e.hash), h('span', { testid: 'map-name' }, e.name))
    }
    const li = h('div', { class: 'campaign-row', testid: 'library-item', draggable: 'true', title: e.path, 'data-path': e.path, 'data-kind': e.kind }, thumbnail(e.hash), h('span', { testid: 'library-name' }, e.name))
    li.addEventListener('dragstart', (ev) => {
      const item: LibraryItem = { hash: e.hash, name: e.name, kind: e.kind, width: e.width, ring: e.ring }
      ev.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(item))
      if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'copy'
    })
    return li
  }
  const draw = (info: CampaignInfo | null): void => {
    const entries = (info?.entries ?? []).filter((e) => e.section === section)
    const groups = new Map<string, CampaignEntry[]>()
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
  const message = h('p', { class: 'hint', testid: `add-message-${section}` })
  const add = h('button', {
    class: 'secondary',
    testid: `add-${section}`,
    onclick: async () => {
      const r = await window.mesa.addFiles(section)
      message.textContent = r.ok ? `Adicionados: ${r.added.map((p) => p.split('/').pop()).join(', ')}` : ''
    }
  }, 'Adicionar arquivos')
  const root = h('section', { class: 'panel', testid: `section-${section}` }, h('h3', {}, TITLES[section]), add, message, body)
  return { root, draw }
}
