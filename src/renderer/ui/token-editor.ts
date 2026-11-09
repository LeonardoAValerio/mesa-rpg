import { FACTIONS, type Faction, type Token } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

const MASTER = 'Mestre'

/** Master-only editor of the selected token: name, faction, size, owner, hide/show, remove (TOK-07, TOK-08, PERM-01, PERM-05, PERM-06). */
export function tokenEditor(client: TableClient): { root: HTMLElement; select(id: string | null): void; destroy(): void } {
  let selected: string | null = null
  const message = h('p', { class: 'error', testid: 'token-message' })
  const name = h('input', { testid: 'token-name', maxlength: 100 })
  const faction = h('select', { testid: 'token-faction' }, h('option', { value: '' }, 'Nenhum'), ...FACTIONS.map((f) => h('option', { value: f }, f)))
  const size = h('input', { testid: 'token-size', type: 'number', min: 0.25, max: 20, step: 0.25 })
  const owner = h('select', { testid: 'token-owner' })
  const hide = h('button', { testid: 'token-hide', class: 'secondary' })
  const remove = h('button', { testid: 'token-remove', class: 'danger' }, 'Remover')
  const body = h('div', { class: 'editor-body' },
    h('label', {}, 'Nome', name),
    h('div', { class: 'row' }, h('label', {}, 'Facção', faction), h('label', {}, 'Tamanho', size)),
    h('label', {}, 'Dono', owner),
    h('div', { class: 'row' }, hide, remove),
    message
  )
  const title = h('h3', {}, 'Token')
  const root = h('section', { class: 'panel', testid: 'token-editor', hidden: true }, title, body)

  const token = (): Token | null => (selected ? (client.view?.tokens[selected] ?? null) : null)
  const send = async (action: Parameters<TableClient['send']>[0]): Promise<void> => {
    const r = await client.send(action)
    message.textContent = r.ok ? '' : r.reason
  }

  name.addEventListener('change', () => selected && void send({ type: 'token/update', id: selected, name: name.value }))
  faction.addEventListener('change', () => selected && void send({ type: 'token/update', id: selected, ring: (faction.value || null) as Faction | null }))
  size.addEventListener('change', () => selected && void send({ type: 'token/update', id: selected, width: Number(size.value) }))
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
    title.textContent = `Token: ${t.name}`
    if (document.activeElement !== name) name.value = t.name
    faction.value = t.ring ?? ''
    size.value = String(t.width)
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
