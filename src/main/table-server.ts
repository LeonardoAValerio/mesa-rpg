import { randomInt } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import { parseClientMsg, type Action, type ClientMsg, type Ephemeral, type ServerMsg } from '../core/protocol'
import { createLimiter } from '../core/ratelimit'
import { applyAction, type ReducerCtx } from '../core/reducer'
import { normalizeName, validateJoin } from '../core/session-rules'
import { versionError } from '../core/version'
import { imageInfo } from '../core/image-info'
import { emptyScene, type Actor, type LibraryItem, type LogEntry, type Role, type Scene, type View } from '../core/types'
import { diffViews, viewFor } from '../core/view'
import { AssetStore, HASH_RE } from './asset-store'

export const MASTER_NAME = 'Mestre'

interface Session {
  ws: WebSocket
  name: string
  role: Role
  alive: boolean
  last: View | null
  limiter: ReturnType<typeof createLimiter>
  strokes: Set<string>
}

/** DICE-02: each die is drawn uniformly from 1..max with the OS CSPRNG. */
export const cryptoRng = (max: number): number => randomInt(1, max + 1)

export interface TableServerOptions {
  port: number
  host?: string
  hostToken: string
  heartbeatMs?: number
  store?: AssetStore
  /**
   * VER-01..VER-05: the app version; a join from any other version (or none) is refused.
   * Left out only by tests of other rules, where no version is checked.
   */
  version?: string
}

export interface TableServer {
  readonly port: number
  readonly host: string
  players(): string[]
  getScene(): Scene
  setScene(scene: Scene): void
  readonly store: AssetStore
  /** Adds token images to the master's library (sent to the master only). */
  addLibrary(items: LibraryItem[]): void
  close(): Promise<void>
}

export async function startTableServer(opts: TableServerOptions): Promise<TableServer> {
  const host = opts.host ?? '0.0.0.0'
  const sessions = new Set<Session>()
  let scene: Scene = emptyScene()
  let idSeq = 0
  const ctx: ReducerCtx = { rng: cryptoRng, now: () => Date.now(), newId: () => `${Date.now().toString(36)}-${++idSeq}` }
  const log: LogEntry[] = []

  const store = opts.store ?? new AssetStore()
  let library: LibraryItem[] = []

  /** ASSET-06: only images the scene or the library use are served; nothing else on disk is reachable. */
  const referenced = (hash: string): boolean =>
    scene.map?.hash === hash || Object.values(scene.tokens).some((t) => t.hash === hash) || library.some((l) => l.hash === hash)

  const http: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const m = /^\/asset\/([^/?#]+)$/.exec(req.url ?? '')
    const hash = m?.[1] ?? ''
    const bytes = req.method === 'GET' && HASH_RE.test(hash) && referenced(hash) ? store.get(hash) : null
    if (!bytes) {
      res.writeHead(404).end()
      return
    }
    const type = imageInfo(bytes)?.type ?? 'png'
    // the window that fetches it may be on another origin (the dev server at http://localhost:5173)
    res.writeHead(200, { 'Content-Type': `image/${type}`, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' })
    res.end(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength))
  })
  const wss = new WebSocketServer({ server: http, maxPayload: 1024 * 1024 })
  wss.on('error', () => {}) // ws re-emits the http server's errors; listen() below reports them

  const send = (s: Session, msg: ServerMsg): void => {
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify(msg))
  }
  const joined = (): Session[] => [...sessions]
  const names = (): string[] => joined().map((s) => s.name)
  const actorOf = (s: Session): Actor => ({ role: s.role, name: s.name })

  /** Sends each session only what changed in what it may see (diffs per viewer). */
  const broadcastViews = (): void => {
    const players = names()
    for (const s of sessions) {
      const next = viewFor(scene, actorOf(s), players)
      const ops = s.last ? diffViews(s.last, next) : []
      s.last = next
      if (ops.length) send(s, { t: 'patch', ops })
    }
  }

  /** TOOL-01..05: ruler, ping and strokes go to everyone else; pings and new strokes count against the limit. */
  const handleEphemeral = (s: Session, e: Ephemeral): void => {
    if (e.type === 'ping' || (e.type === 'stroke' && !s.strokes.has(e.strokeId))) {
      if (!s.limiter.allow(Date.now())) return
      if (e.type === 'stroke') {
        s.strokes.add(e.strokeId)
        if (s.strokes.size > 200) s.strokes.delete(s.strokes.values().next().value as string)
      }
    }
    for (const x of sessions) if (x !== s) send(x, { t: 'ephemeral', from: s.name, e })
  }

  const handleAction = (s: Session, id: string, action: Action): void => {
    if ((action.type === 'map/set' || action.type === 'token/place') && !store.has(action.hash)) {
      send(s, { t: 'reject', id, reason: 'Arquivo desconhecido' })
      return
    }
    const r = applyAction(scene, actorOf(s), action, ctx)
    if (!r.ok) {
      send(s, { t: 'reject', id, reason: r.reason })
      return
    }
    scene = r.scene
    send(s, { t: 'ack', id })
    if (r.log) {
      log.push(r.log)
      if (log.length > 200) log.splice(0, log.length - 200)
      for (const x of sessions) send(x, { t: 'log', entry: r.log })
    }
    broadcastViews()
  }

  const handleJoin = (ws: WebSocket, msg: Extract<ClientMsg, { t: 'join' }>): Session | null => {
    const isMaster = msg.hostToken !== undefined && msg.hostToken === opts.hostToken
    const name = isMaster ? MASTER_NAME : normalizeName(msg.name)
    const playerCount = joined().filter((s) => s.role === 'player').length
    // The version is checked before the name rules, so a refused join never becomes a session (VER-05).
    const versionReason = opts.version === undefined ? null : versionError(opts.version, msg.version)
    const reason =
      versionReason ??
      (isMaster
        ? joined().some((s) => s.role === 'master')
          ? 'Nome já em uso'
          : null
        : validateJoin(name, [...names(), MASTER_NAME], playerCount))
    if (reason) {
      ws.send(JSON.stringify({ t: 'join-error', reason } satisfies ServerMsg))
      ws.close(4000, reason)
      return null
    }
    const session: Session = {
      ws,
      name,
      role: isMaster ? 'master' : 'player',
      alive: true,
      last: null,
      limiter: createLimiter(),
      strokes: new Set()
    }
    sessions.add(session)
    const view = viewFor(scene, actorOf(session), names())
    session.last = view
    send(session, { t: 'welcome', you: { role: session.role, name }, view, log: log.slice(-200), version: opts.version })
    if (session.role === 'master') send(session, { t: 'library', items: library })
    broadcastViews()
    return session
  }

  wss.on('connection', (ws) => {
    let session: Session | null = null
    ws.on('pong', () => {
      if (session) session.alive = true
    })
    ws.on('message', (data, isBinary) => {
      if (isBinary) return
      const msg = parseClientMsg(data.toString())
      if (!msg) return // NET-15: malformed or unknown messages are dropped
      if (!session) {
        if (msg.t === 'join') session = handleJoin(ws, msg)
        return
      }
      if (msg.t === 'action') handleAction(session, msg.id, msg.action)
      else if (msg.t === 'ephemeral') handleEphemeral(session, msg.e)
    })
    ws.on('close', () => {
      if (session && sessions.delete(session)) broadcastViews()
    })
    ws.on('error', () => ws.terminate())
  })

  const heartbeat = setInterval(() => {
    for (const s of sessions) {
      if (!s.alive) {
        s.ws.terminate()
        continue
      }
      s.alive = false
      s.ws.ping()
    }
  }, opts.heartbeatMs ?? 5000)
  heartbeat.unref()

  await new Promise<void>((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException): void => {
      clearInterval(heartbeat)
      wss.close()
      reject(new Error(err.code === 'EADDRINUSE' ? `Porta ${opts.port} em uso` : err.message))
    }
    http.once('error', onError)
    http.listen(opts.port, host, () => {
      http.off('error', onError)
      resolve()
    })
  })
  const address = http.address() as AddressInfo

  return {
    port: address.port,
    host: address.address,
    players: names,
    store,
    addLibrary: (items) => {
      const known = new Set(library.map((l) => l.hash))
      library = [...library, ...items.filter((i) => !known.has(i.hash) && known.add(i.hash))]
      for (const s of sessions) if (s.role === 'master') send(s, { t: 'library', items: library })
    },
    getScene: () => scene,
    setScene: (next) => {
      scene = next
      broadcastViews()
    },
    close: async () => {
      clearInterval(heartbeat)
      for (const s of sessions) send(s, { t: 'closed' })
      for (const ws of wss.clients) ws.close(1001, 'closed')
      await new Promise<void>((resolve) => wss.close(() => resolve()))
      for (const ws of wss.clients) ws.terminate()
      await new Promise<void>((resolve) => {
        http.close(() => resolve())
        http.closeAllConnections()
      })
    }
  }
}
