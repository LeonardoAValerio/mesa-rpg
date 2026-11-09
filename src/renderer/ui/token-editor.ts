import { clampWidth, normalizeRotation, type ItemKind, type Movement } from '../../core/items'
import { FACTIONS, type Faction, type Token } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

const MASTER = 'Mestre'
const KINDS: Array<[ItemKind, string]> = [['character', 'Personagem'], ['object', 'Objeto']]
const MOVEMENTS: Array<[Movement, string]> = [['free', 'Livre'], ['master', 'Só mestre'], ['locked', 'Travado']]

/**
 * Master-only editor of the selected item: Nome, Tipo, Tamanho, Rotação, Anel, Movimento, Dono, Ocultar, Remover
 * (ITEM-03, ITEM-06, ITEM-12, ITEM-15, ITEM-16, PERM-01, PERM-05, PERM-06, TOK-08). Anel and Dono are for characters.
 */
export function tokenEditor(client: TableClient): { root: HTMLElement; select(id: string | null): void; destroy(): void } {
  let selected: string | null = null
  const message = h('p', { class: 'error', testid: 'token-message' })
  const name = h('input', { testid: 'token-name', maxlength: 100 })
  const kind = h('select', { testid: 'token-kind' }, ...KINDS.map(([v, l]) => h('option', { value: v }, l)))
  const size = h('input', { testid: 'token-size', type: 'number', min: 0.25, max: 20, step: 0.25 })
  const rotation = h('input', { testid: 'token-rotation', type: 'number', min: 0, max: 345, step: 15 })
  const ring = h('select', { testid: 'token-ring' }, h('option', { value: '' }, 'Nenhum'), ...FACTIONS.map((f) => h('option', { value: f }, f)))
  const movement = h('select', { testid: 'token-movement' }, ...MOVEMENTS.map(([v, l]) => h('option', { value: v }, l)))
  const owner = h('select', { testid: 'token-owner' })
  const hide = h('button', { testid: 'token-hide', class: 'secondary' })
  const remove = h('button', { testid: 'token-remove', class: 'danger' }, 'Remover')
  const ringLabel = h('label', { testid: 'token-ring-label' }, 'Anel', ring)
  const ownerLabel = h('label', { testid: 'token-owner-label' }, 'Dono', owner)
  const body = h('div', { class: 'editor-body' },
    h('label', {}, 'Nome', name),
    h('div', { class: 'row' }, h('label', {}, 'Tipo', kind), h('label', {}, 'Movimento', movement)),
    h('div', { class: 'row' }, h('label', {}, 'Tamanho (células)', size), h('label', {}, 'Rotação (°)', rotation)),
    ringLabel,
    ownerLabel,
    h('div', { class: 'row' }, hide, remove),
    message
  )
  const title = h('h3', {}, 'Item')
  const root = h('section', { class: 'panel', testid: 'token-editor', hidden: true }, title, body)

  const token = (): Token | null => (selected ? (client.view?.tokens[selected] ?? null) : null)
  const send = async (action: Parameters<TableClient['send']>[0]): Promise<void> => {
    const r = await client.send(action)
    message.textContent = r.ok ? '' : r.reason
  }
  const update = (patch: Omit<Extract<Parameters<TableClient['send']>[0], { type: 'token/update' }>, 'type' | 'id'>): void => {
    if (selected) void send({ type: 'token/update', id: selected, ...patch })
  }

  name.addEventListener('change', () => update({ name: name.value }))
  kind.addEventListener('change', () => update({ kind: kind.value as ItemKind }))
  size.addEventListener('change', () => {
    size.value = String(clampWidth(Number(size.value))) // ITEM-03
    update({ width: Number(size.value) })
  })
  rotation.addEventListener('change', () => {
    rotation.value = String(normalizeRotation(Number(rotation.value))) // ITEM-12
    update({ rotation: Number(rotation.value) })
  })
  ring.addEventListener('change', () => update({ ring: (ring.value || null) as Faction | null }))
  movement.addEventListener('change', () => update({ movement: movement.value as Movement }))
  owner.addEventListener('change', () => selected && void send({ type: 'token/owner', id: selected, owner: owner.value || null }))
  hide.addEventListener('click', () => {
    const t = token()
    if (t) void send({ type: t.hidden ? 'token/show' : 'token/hide', id: t.id })
  })
  remove.addEventListener('click', () => selected && void send({ type: 'token/remove', id: selected }))

  const fill = (): void => {
    const t = token()
    root.hidden = !t
    if (!t) return
    title.textContent = `${t.kind === 'object' ? 'Objeto' : 'Personagem'}: ${t.name}`
    const editing = document.activeElement
    if (editing !== name) name.value = t.name
    kind.value = t.kind
    if (editing !== size) size.value = String(t.width)
    if (editing !== rotation) rotation.value = String(t.rotation)
    ring.value = t.ring ?? ''
    movement.value = t.movement
    const character = t.kind === 'character'
    ringLabel.hidden = !character
    ownerLabel.hidden = !character
    const players = (client.view?.players ?? []).filter((p) => p !== MASTER)
    if (t.owner && !players.includes(t.owner)) players.push(t.owner) // keeps an offline owner (NET-11)
    owner.replaceChildren(h('option', { value: '' }, 'Ninguém'), ...players.map((p) => h('option', { value: p }, p)))
    owner.value = t.owner ?? ''
    hide.textContent = t.hidden ? 'Mostrar' : 'Esconder'
  }
  const off = client.on('view', fill)
  return {
    root,
    select: (id) => {
      selected = id
      message.textContent = ''
      fill()
    },
    destroy: off
  }
}
