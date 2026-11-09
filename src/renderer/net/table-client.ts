import type { Action, Ephemeral, ServerMsg } from '../../core/protocol'
import type { LibraryItem, LogEntry, PatchOp, Role, View } from '../../core/types'

export const JOIN_TIMEOUT_MS = 5000
export const RETRY_EVERY_MS = 3000
export const RETRY_FOR_MS = 60000

export const MSG_RECONNECTING = 'Conexão com o mestre perdida — tentando reconectar'
export const MSG_LOST = 'Conexão perdida'
export const MSG_CLOSED = 'O mestre encerrou a mesa'

export type ClientStatus =
  | { kind: 'connecting' }
  | { kind: 'connected' }
  | { kind: 'reconnecting'; message: typeof MSG_RECONNECTING }
  | { kind: 'lost'; message: typeof MSG_LOST }
  | { kind: 'closed'; message: typeof MSG_CLOSED }
  | { kind: 'error'; message: string }

export interface ConnectOptions {
  ip: string
  port: number
  name: string
  hostToken?: string
  /** Defaults to the runtime's WebSocket; tests pass the `ws` package's browser-compatible client. */
  WebSocketImpl?: new (url: string) => WebSocket
}

const OPEN = 1

export type ActionResult = { ok: true } | { ok: false; reason: string }

type Listener<T> = (v: T) => void

export function applyOps(view: View, ops: PatchOp[]): View {
  const next: View = { ...view, tokens: { ...view.tokens } }
  for (const o of ops) {
    if (o.op === 'token/upsert') next.tokens[o.token.id] = o.token
    else if (o.op === 'token/remove') delete next.tokens[o.id]
    else if (o.op === 'map') next.map = o.map
    else if (o.op === 'grid') next.grid = o.grid
    else if (o.op === 'fog') next.fog = o.fog
    else if (o.op === 'players') next.players = o.players
  }
  return next
}

export class TableClient {
  status: ClientStatus = { kind: 'connecting' }
  view: View | null = null
  log: LogEntry[] = []
  library: LibraryItem[] = []
  you: { role: Role; name: string } | null = null

  private ws: WebSocket | null = null
  private everJoined = false
  private stopped = false
  private lostAt = 0
  private seq = 0
  private pending = new Map<string, (r: ActionResult) => void>()
  private timers = new Set<ReturnType<typeof setTimeout>>()
  private listeners = {
    status: new Set<Listener<ClientStatus>>(),
    view: new Set<Listener<View>>(),
    log: new Set<Listener<LogEntry>>(),
    ephemeral: new Set<Listener<{ from: string; e: Ephemeral }>>(),
    library: new Set<Listener<LibraryItem[]>>()
  }

  constructor(private readonly opts: ConnectOptions) {}

  /** http://ip:port of the master, where images are served. */
  get httpBase(): string {
    return `http://${this.opts.ip}:${this.opts.port}`
  }

  on<K extends keyof TableClient['listeners']>(
    kind: K,
    fn: TableClient['listeners'][K] extends Set<infer L> ? L : never
  ): () => void {
    const set = this.listeners[kind] as Set<typeof fn>
    set.add(fn)
    return () => set.delete(fn)
  }

  /** Resolves when joined; rejects with the message to show when the first connection fails (NET-08, NET-07). */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => this.attempt(resolve, reject))
  }

  send(action: Action): Promise<ActionResult> {
    const id = `${++this.seq}`
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== OPEN || this.status.kind !== 'connected') {
        resolve({ ok: false, reason: 'offline' })
        return
      }
      this.pending.set(id, resolve)
      this.ws.send(JSON.stringify({ t: 'action', id, action }))
    })
  }

  sendEphemeral(e: Ephemeral): void {
    if (this.ws?.readyState === OPEN && this.status.kind === 'connected') this.ws.send(JSON.stringify({ t: 'ephemeral', e }))
  }

  close(): void {
    this.stopped = true
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
    this.ws?.close()
  }

  private later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const t = setTimeout(() => {
      this.timers.delete(t)
      fn()
    }, ms)
    this.timers.add(t)
    return t
  }

  private setStatus(s: ClientStatus): void {
    this.status = s
    for (const fn of this.listeners.status) fn(s)
  }

  private attempt(resolve?: () => void, reject?: (err: Error) => void): void {
    if (this.stopped) return
    const { ip, port, name, hostToken } = this.opts
    let settled = false
    let ws: WebSocket
    try {
      ws = new (this.opts.WebSocketImpl ?? WebSocket)(`ws://${ip}:${port}`)
    } catch {
      this.failAttempt(reject)
      return
    }
    this.ws = ws
    const timeout = this.later(() => {
      if (settled) return
      settled = true
      ws.close()
      this.failAttempt(reject)
    }, JOIN_TIMEOUT_MS)

    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', name, hostToken }))
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as ServerMsg
      if (msg.t === 'welcome') {
        settled = true
        clearTimeout(timeout)
        this.timers.delete(timeout)
        this.everJoined = true
        this.you = msg.you
        this.view = msg.view
        this.log = msg.log
        this.setStatus({ kind: 'connected' })
        for (const fn of this.listeners.view) fn(msg.view)
        resolve?.()
        return
      }
      if (msg.t === 'join-error') {
        settled = true
        clearTimeout(timeout)
        this.timers.delete(timeout)
        if (this.everJoined) {
          this.failAttempt()
        } else {
          this.stopped = true
          this.setStatus({ kind: 'error', message: msg.reason })
          reject?.(new Error(msg.reason))
        }
        return
      }
      this.handle(msg)
    }
    ws.onclose = () => {
      clearTimeout(timeout)
      this.timers.delete(timeout)
      if (this.ws !== ws) return
      this.rejectPending()
      if (this.stopped || this.status.kind === 'closed') return
      if (!settled) {
        settled = true
        this.failAttempt(reject)
      } else if (this.status.kind === 'connected') {
        this.lostAt = Date.now()
        this.setStatus({ kind: 'reconnecting', message: MSG_RECONNECTING })
        this.later(() => this.attempt(), RETRY_EVERY_MS)
      }
    }
    ws.onerror = () => {
      // A failed handshake reports `error`; some runtimes deliver `close` late or never, so it counts here.
      if (settled || this.ws !== ws) return
      settled = true
      clearTimeout(timeout)
      this.timers.delete(timeout)
      this.failAttempt(reject)
    }
  }

  private failAttempt(reject?: (err: Error) => void): void {
    if (!this.everJoined) {
      this.stopped = true
      const message = `Não foi possível conectar a ${this.opts.ip}:${this.opts.port}`
      this.setStatus({ kind: 'error', message })
      reject?.(new Error(message))
      return
    }
    if (Date.now() - this.lostAt + RETRY_EVERY_MS > RETRY_FOR_MS) {
      this.stopped = true
      this.setStatus({ kind: 'lost', message: MSG_LOST })
      return
    }
    this.later(() => this.attempt(), RETRY_EVERY_MS)
  }

  private rejectPending(): void {
    for (const r of this.pending.values()) r({ ok: false, reason: 'offline' })
    this.pending.clear()
  }

  private handle(msg: ServerMsg): void {
    switch (msg.t) {
      case 'patch':
        if (!this.view) return
        this.view = applyOps(this.view, msg.ops)
        for (const fn of this.listeners.view) fn(this.view)
        return
      case 'ack':
        this.pending.get(msg.id)?.({ ok: true })
        this.pending.delete(msg.id)
        return
      case 'reject':
        this.pending.get(msg.id)?.({ ok: false, reason: msg.reason })
        this.pending.delete(msg.id)
        return
      case 'log':
        this.log = [...this.log, msg.entry].slice(-200)
        for (const fn of this.listeners.log) fn(msg.entry)
        return
      case 'ephemeral':
        for (const fn of this.listeners.ephemeral) fn({ from: msg.from, e: msg.e })
        return
      case 'library':
        this.library = msg.items
        for (const fn of this.listeners.library) fn(msg.items)
        return
      case 'closed':
        this.stopped = true
        this.setStatus({ kind: 'closed', message: MSG_CLOSED })
        return
    }
  }
}
