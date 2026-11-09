import { validChat } from '../../core/chat'
import { parseDice } from '../../core/dice'
import type { LogEntry, RollResult } from '../../core/types'
import type { TableClient } from '../net/table-client'
import { h } from './dom'

/** One roll as text pieces: each die, the dropped ones marked, and the total (DICE-01, DICE-03). */
function rollLine(roll: RollResult): HTMLElement {
  const line = h('span', { class: 'roll' })
  roll.terms.forEach((t, i) => {
    if (i > 0 || t.sign < 0) line.append(t.sign < 0 ? ' − ' : ' + ')
    if (t.kind === 'const') {
      line.append(String(t.value))
      return
    }
    line.append('[')
    t.rolls!.forEach((v, j) => {
      if (j > 0) line.append(', ')
      line.append(h('span', { class: t.kept![j] ? 'die' : 'die dropped', testid: t.kept![j] ? 'die' : 'die-dropped' }, String(v)))
    })
    line.append(']')
  })
  line.append(' = ', h('strong', { testid: 'roll-total' }, String(roll.total)))
  return line
}

function entryEl(e: LogEntry): HTMLElement {
  if (e.kind === 'chat') return h('li', { testid: 'log-entry', class: 'chat' }, `${e.author}: ${e.text}`)
  return h('li', { testid: 'log-entry', class: 'roll-entry' }, `${e.author} rolou ${e.text}: `, rollLine(e.roll!))
}

/** Dice roller and chat with the shared history (DICE-01..04, CHAT-01..04). Text goes in as text, never HTML. */
export function logPanel(client: TableClient): { root: HTMLElement; destroy(): void } {
  const list = h('ul', { class: 'log', testid: 'log' })
  const error = h('p', { class: 'error', testid: 'dice-error' })
  const dice = h('input', { testid: 'dice-input', placeholder: '2d6+3, 2d20kh1' })
  const chat = h('input', { testid: 'chat-input', placeholder: 'Mensagem', maxlength: 500 })

  const add = (e: LogEntry): void => {
    list.append(entryEl(e))
    while (list.children.length > 200) list.firstElementChild?.remove()
    list.scrollTop = list.scrollHeight
  }
  for (const e of client.log) add(e)
  const off = client.on('log', add)

  const roll = async (): Promise<void> => {
    const expr = dice.value
    const parsed = parseDice(expr)
    if ('error' in parsed) {
      error.textContent = parsed.error
      return
    }
    const r = await client.send({ type: 'roll', expr })
    error.textContent = r.ok ? '' : r.reason
  }
  const say = async (): Promise<void> => {
    if (!validChat(chat.value)) return // CHAT-02
    const r = await client.send({ type: 'chat', text: chat.value })
    if (r.ok) chat.value = ''
  }
  dice.addEventListener('keydown', (e) => e.key === 'Enter' && void roll())
  chat.addEventListener('keydown', (e) => e.key === 'Enter' && void say())

  const root = h('section', { class: 'panel log-panel', testid: 'log-panel' },
    h('h3', {}, 'Dados e chat'),
    list,
    h('div', { class: 'row' }, dice, h('button', { testid: 'dice-roll', onclick: () => void roll() }, 'Rolar')),
    error,
    h('div', { class: 'row' }, chat, h('button', { testid: 'chat-send', onclick: () => void say() }, 'Enviar'))
  )
  return { root, destroy: off }
}
