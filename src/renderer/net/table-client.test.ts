import { createServer, Socket, type Server } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket as WsClient } from 'ws'
import { startTableServer, type TableServer } from '../../main/table-server'
import { MSG_LOST, MSG_RECONNECTING, TableClient } from './table-client'

// Real sockets, fake clock: only setTimeout/clearTimeout/Date are faked, so I/O keeps flowing.
async function until(cond: () => boolean, what: string): Promise<void> {
  const start = process.hrtime.bigint()
  while (!cond()) {
    if (process.hrtime.bigint() - start > 3_000_000_000n) throw new Error(`timeout: ${what}`)
    await new Promise((r) => setImmediate(r))
  }
}
async function settleIo(): Promise<void> {
  for (let i = 0; i < 50; i++) await new Promise((r) => setImmediate(r))
}

/** TCP proxy between client and server: "forward" pipes, "refuse" accepts and drops (a dead VPN link). */
class Proxy {
  mode: 'forward' | 'refuse' = 'forward'
  refused = 0
  private sockets = new Set<Socket>()
  private server: Server
  port = 0
  constructor(private target: number) {
    this.server = createServer((s) => {
      this.sockets.add(s)
      s.on('close', () => this.sockets.delete(s))
      s.on('error', () => {})
      if (this.mode === 'refuse') {
        this.refused++
        s.destroy()
        return
      }
      const up = new Socket()
      up.on('error', () => s.destroy())
      s.on('error', () => up.destroy())
      this.sockets.add(up)
      up.connect(this.target, '127.0.0.1', () => {
        s.pipe(up)
        up.pipe(s)
      })
      up.on('close', () => s.destroy())
      s.on('close', () => up.destroy())
    })
  }
  listen(): Promise<void> {
    return new Promise((r) =>
      this.server.listen(0, '127.0.0.1', () => {
        this.port = (this.server.address() as { port: number }).port
        r()
      })
    )
  }
  cut(): void {
    this.mode = 'refuse'
    for (const s of this.sockets) s.destroy()
  }
  close(): Promise<void> {
    for (const s of this.sockets) s.destroy()
    return new Promise((r) => this.server.close(() => r()))
  }
}

let table: TableServer | null = null
let proxy: Proxy | null = null
let client: TableClient | null = null
let silent: Server | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
})
afterEach(async () => {
  client?.close()
  vi.useRealTimers()
  await proxy?.close()
  await table?.close()
  if (silent) await new Promise<void>((r) => silent!.close(() => r()))
  table = proxy = client = silent = null
})

async function connectedThroughProxy(name = 'Ana'): Promise<TableClient> {
  table = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't', heartbeatMs: 60_000 })
  proxy = new Proxy(table.port)
  await proxy.listen()
  client = new TableClient({ ip: '127.0.0.1', port: proxy.port, name, WebSocketImpl: WsClient as never })
  await client.connect()
  return client
}

describe('TableClient', () => {
  it('[C8] NET-08 gives up after 5 s without an answer with "Não foi possível conectar a <IP>:<porta>"', async () => {
    const held: Socket[] = []
    silent = createServer((s) => held.push(s)) // accepts TCP, never answers the WebSocket handshake
    await new Promise<void>((r) => silent!.listen(0, '127.0.0.1', () => r()))
    const port = (silent.address() as { port: number }).port
    client = new TableClient({ ip: '127.0.0.1', port, name: 'Ana', WebSocketImpl: WsClient as never })
    const result = client.connect().then(
      () => 'joined',
      (e: Error) => e.message
    )
    await until(() => held.length === 1, 'tcp accepted')
    await vi.advanceTimersByTimeAsync(4999)
    await settleIo()
    expect(client.status.kind).toBe('connecting')
    await vi.advanceTimersByTimeAsync(1)
    expect(await result).toBe(`Não foi possível conectar a 127.0.0.1:${port}`)
    expect(client.status).toEqual({ kind: 'error', message: `Não foi possível conectar a 127.0.0.1:${port}` })
    for (const s of held) s.destroy()
  })

  it('[C10] NET-10 shows "Conexão com o mestre perdida — tentando reconectar" on a drop and retries every 3 s', async () => {
    const c = await connectedThroughProxy()
    proxy!.cut()
    await until(() => c.status.kind === 'reconnecting', 'reconnecting')
    expect(c.status).toEqual({ kind: 'reconnecting', message: MSG_RECONNECTING })
    await vi.advanceTimersByTimeAsync(2999)
    await settleIo()
    expect(proxy!.refused).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    await until(() => proxy!.refused === 1, 'first retry at 3 s')
    await vi.advanceTimersByTimeAsync(2999)
    await settleIo()
    expect(proxy!.refused).toBe(1)
    await vi.advanceTimersByTimeAsync(1)
    await until(() => proxy!.refused === 2, 'second retry at 6 s')
    expect(c.status.kind).toBe('reconnecting')
  })

  it('rejoins with the same name once the link is back (NET-10, NET-11)', async () => {
    const c = await connectedThroughProxy('Ana')
    proxy!.cut()
    await until(() => c.status.kind === 'reconnecting', 'reconnecting')
    await until(() => table!.players().length === 0, 'server saw the drop')
    proxy!.mode = 'forward'
    await vi.advanceTimersByTimeAsync(3000)
    await until(() => c.status.kind === 'connected', 'reconnected')
    expect(c.you).toEqual({ role: 'player', name: 'Ana' })
    expect(table!.players()).toEqual(['Ana'])
  })

  it('[C12] NET-12 turns into "Conexão perdida" after 60 s of failed retries and stops trying', async () => {
    const c = await connectedThroughProxy()
    proxy!.cut()
    await until(() => c.status.kind === 'reconnecting', 'reconnecting')
    for (let i = 1; i <= 19; i++) {
      await vi.advanceTimersByTimeAsync(3000)
      await until(() => proxy!.refused === i, `retry ${i}`)
      await settleIo()
      expect(c.status.kind).toBe('reconnecting')
    }
    await vi.advanceTimersByTimeAsync(3000)
    await until(() => proxy!.refused === 20, 'retry 20 at 60 s')
    await until(() => c.status.kind === 'lost', 'lost')
    expect(c.status).toEqual({ kind: 'lost', message: MSG_LOST })
    await vi.advanceTimersByTimeAsync(30_000)
    await settleIo()
    expect(proxy!.refused).toBe(20)
  })
})
