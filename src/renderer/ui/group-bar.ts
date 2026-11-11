import type { TableClient } from '../net/table-client'
import type { Board } from '../board/board'
import { h } from './dom'

/**
 * BRD-15, BRD-16, BRD-18, BRD-19: over the top of the map, "Agrupar" with 2+ items selected and "Desagrupar" when the
 * selection is one group; Ctrl+G and Ctrl+Shift+G do the same; a refusal shows its reason.
 */
export function groupBar(host: HTMLElement, board: Board, client: TableClient): { destroy(): void } {
  const message = h('span', { class: 'group-message', testid: 'group-message', role: 'status' })
  const groupBtn = h('button', { testid: 'group', onmousedown: (e: Event) => e.preventDefault(), onclick: () => void group() }, 'Agrupar')
  const ungroupBtn = h('button', { testid: 'ungroup', class: 'secondary', onmousedown: (e: Event) => e.preventDefault(), onclick: () => void ungroup() }, 'Desagrupar')
  const root = h('div', { class: 'group-bar', testid: 'group-bar', hidden: true }, groupBtn, ungroupBtn, message)
  host.append(root)

  /** The group the selection is exactly, if it is one. */
  const wholeGroup = (): string | null => {
    const tokens = client.view?.tokens ?? {}
    const ids = board.selection.ids
    const g = ids.length > 1 ? tokens[ids[0]]?.group : null
    if (!g || !ids.every((id) => tokens[id]?.group === g)) return null
    return Object.values(tokens).filter((t) => t.group === g).length === ids.length ? g : null
  }
  const show = (reason: string): void => {
    message.textContent = reason
    root.hidden = false
  }
  const draw = (): void => {
    const many = board.selection.ids.length > 1
    const g = wholeGroup()
    groupBtn.hidden = !many || !!g
    ungroupBtn.hidden = !g
    if (!many) message.textContent = ''
    root.hidden = !many && !message.textContent
  }
  const group = async (): Promise<void> => {
    if (board.selection.ids.length < 2 || wholeGroup()) return
    const r = await client.send({ type: 'token/group', ids: board.selection.ids })
    message.textContent = r.ok ? '' : r.reason // BRD-16: "Sem permissão"
    draw()
  }
  const ungroup = async (): Promise<void> => {
    const g = wholeGroup()
    if (!g) return
    const r = await client.send({ type: 'token/ungroup', group: g })
    message.textContent = r.ok ? '' : r.reason
    draw()
  }
  const key = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'g') return
    e.preventDefault()
    void (e.shiftKey ? ungroup() : group())
  }
  const refused = (reason: string): void => show(reason)
  window.addEventListener('keydown', key)
  board.selection.changed.add(draw)
  board.moveRefused.add(refused)
  const off = client.on('view', draw)
  draw()
  return {
    destroy: () => {
      window.removeEventListener('keydown', key)
      board.selection.changed.delete(draw)
      board.moveRefused.delete(refused)
      off()
      root.remove()
    }
  }
}
