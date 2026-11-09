// Test helpers for real ws clients against a real TableServer. Not shipped: only *.test.ts import it.
import { WebSocket } from 'ws'
import type { ServerMsg } from '../core/protocol'

export interface TestClient {
  ws: WebSocket
  msgs: ServerMsg[]
  send(msg: unknown): void
  sendRaw(text: string): void
  next<T extends ServerMsg['t']>(t: T, pred?: (m: Extract<ServerMsg, { t: T }>) => boolean, timeoutMs?: number): Promise<Extract<ServerMsg, { t: T }>>
  closed: Promise<void>
  close(): void
}

export async function connectClient(port: number): Promise<TestClient> {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`)
  const msgs: ServerMsg[] = []
  const waiters: Array<() => void> = []
  ws.on('message', (d) => {
    msgs.push(JSON.parse(d.toString()) as ServerMsg)
    for (const w of [...waiters]) w()
  })
  const closed = new Promise<void>((r) => ws.on('close', () => r()))
  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve())
    ws.once('error', reject)
  })
  let cursor = 0
  return {
    ws,
    msgs,
    closed,
    send: (m) => ws.send(JSON.stringify(m)),
    sendRaw: (t) => ws.send(t),
    close: () => ws.close(),
    next: (t, pred, timeoutMs = 2000) =>
      new Promise((resolve, reject) => {
        const check = (): boolean => {
          for (let i = cursor; i < msgs.length; i++) {
            const m = msgs[i]
            if (m.t === t && (!pred || pred(m as never))) {
              cursor = i + 1
              resolve(m as never)
              return true
            }
          }
          return false
        }
        if (check()) return
        const timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(waiter), 1)
          reject(new Error(`timeout waiting for ${t}; got ${JSON.stringify(msgs.slice(cursor))}`))
        }, timeoutMs)
        const waiter = (): void => {
          if (check()) {
            clearTimeout(timer)
            waiters.splice(waiters.indexOf(waiter), 1)
          }
        }
        waiters.push(waiter)
      })
  }
}

export async function joinAs(port: number, name: string, hostToken?: string): Promise<TestClient> {
  const c = await connectClient(port)
  c.send({ t: 'join', name, hostToken })
  await c.next('welcome')
  return c
}
