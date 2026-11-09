import './style.css'
import type { Action } from '../core/protocol'
import { onSession, showHome } from './app'
import { Board, type BoardSnapshot } from './board/board'
import type { ActionResult } from './net/table-client'

declare global {
  interface Window {
    __mesaTest?: {
      board(): BoardSnapshot | null
      send(action: Action): Promise<ActionResult>
    }
  }
}

onSession(async ({ client, screen }) => {
  const board = await Board.create(screen.board, client)
  if (window.mesa.isTest) window.__mesaTest = { board: () => board.snapshot(), send: (a) => client.send(a) }
  return () => {
    if (window.__mesaTest) window.__mesaTest = undefined
    board.destroy()
  }
})

showHome()
