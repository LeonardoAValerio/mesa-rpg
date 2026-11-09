import type { Board, Tool } from '../board/board'
import { h } from './dom'

const TOOLS: Array<{ tool: Tool; label: string; masterOnly?: boolean }> = [
  { tool: 'select', label: 'Mover' },
  { tool: 'ruler', label: 'Régua' },
  { tool: 'ping', label: 'Ping' },
  { tool: 'draw', label: 'Desenho' }
]

/** The board tools in the top bar; one is active at a time. */
export function toolbar(host: HTMLElement, board: Board, extra: Array<{ tool: Tool; label: string }> = []): () => void {
  const buttons = [...TOOLS, ...extra].map(({ tool, label }) =>
    h('button', { testid: `tool-${tool}`, class: 'secondary', 'aria-pressed': tool === board.tool ? 'true' : 'false', onclick: () => pick(tool) }, label)
  )
  const all = [...TOOLS, ...extra]
  const pick = (tool: Tool): void => {
    board.setTool(tool)
    buttons.forEach((b, i) => b.setAttribute('aria-pressed', all[i].tool === tool ? 'true' : 'false'))
  }
  host.append(...buttons)
  return () => buttons.forEach((b) => b.remove())
}
