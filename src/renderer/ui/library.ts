import type { LibraryItem } from '../../core/types'
import type { Board } from '../board/board'
import type { TableClient } from '../net/table-client'
import { clear, h } from './dom'

const DRAG_TYPE = 'application/x-mesa-token'

/** Master-only token library: import the kit folder, load the palette, drag a token onto the map (TOK-01, TOK-04). */
export function libraryPanel(client: TableClient, board: Board, dropZone: HTMLElement): { root: HTMLElement; destroy(): void } {
  const list = h('ul', { class: 'library', testid: 'library' })
  const message = h('p', { class: 'hint', testid: 'library-message' })

  const draw = (items: LibraryItem[]): void => {
    clear(list)
    for (const item of items) {
      const li = h('li', { testid: 'library-item', draggable: 'true', title: `${item.kind === 'object' ? 'objeto' : (item.ring ?? 'personagem')} · ${item.width}` },
        h('span', { testid: 'library-name' }, item.name),
        h('small', {}, ` ${item.kind === 'object' ? 'objeto' : (item.ring ?? 'personagem')} · ${item.width}`)
      )
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData(DRAG_TYPE, JSON.stringify(item))
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
      })
      list.append(li)
    }
  }
  draw(client.library)
  const off = client.on('library', draw)

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
    h('h3', {}, 'Tokens'),
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
    message,
    list
  )
  return {
    root,
    destroy: () => {
      off()
      dropZone.removeEventListener('dragover', onDragOver)
      dropZone.removeEventListener('drop', dropListener)
    }
  }
}
