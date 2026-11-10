import type { LibraryItem } from '../../core/types'
import type { Board } from '../board/board'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

/** What a token row carries when dragged onto the board (CAMP-12, ITEM-10). */
export const DRAG_TYPE = 'application/x-mesa-token'

/** Master-only: the palette, and the board taking a token or object dragged from the campaign lists (CAMP-12, ITEM-10). */
export function libraryPanel(client: TableClient, board: Board, dropZone: HTMLElement): { root: HTMLElement; destroy(): void } {
  const message = h('p', { class: 'hint', testid: 'library-message' })

  const onDragOver = (e: DragEvent): void => {
    if (e.dataTransfer?.types.includes(DRAG_TYPE)) e.preventDefault()
  }
  const onDrop = async (e: DragEvent): Promise<void> => {
    const raw = e.dataTransfer?.getData(DRAG_TYPE)
    if (!raw || !client.view?.map) return
    e.preventDefault()
    const item = JSON.parse(raw) as LibraryItem
    const r = board.app.canvas.getBoundingClientRect()
    const w = board.toWorld(e.clientX - r.left, e.clientY - r.top)
    const at = board.dropAt(item.kind, item.hash, item.width, w.x, w.y, e.shiftKey) // ITEM-10: centred under the cursor
    const res = await client.send({ type: 'token/place', hash: item.hash, name: item.name, kind: item.kind, width: item.width, ring: item.ring, ...at })
    message.textContent = res.ok ? '' : res.reason
  }
  const dropListener = (e: DragEvent): void => void onDrop(e)
  dropZone.addEventListener('dragover', onDragOver)
  dropZone.addEventListener('drop', dropListener)

  const root = h('section', { class: 'panel', testid: 'library-panel' },
    h('h3', {}, 'Paleta'),
    h('div', { class: 'row' },
      h('button', {
        testid: 'load-palette',
        class: 'secondary',
        onclick: async () => {
          const r = await window.mesa.loadPalette()
          if (r.ok) await client.send({ type: 'palette/set', palette: r.palette })
        }
      }, 'Carregar paleta')
    ),
    message
  )
  return {
    root,
    destroy: () => {
      dropZone.removeEventListener('dragover', onDragOver)
      dropZone.removeEventListener('drop', dropListener)
    }
  }
}
