import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocketServer, WebSocket } from 'ws'
import { parseClientMsg, type ClientMsg, type ServerMsg } from '../core/protocol'
import { normalizeName, validateJoin } from '../core/session-rules'
import { emptyScene, type LogEntry, type Role, type Scene, type View } from '../core/types'

export const MASTER_NAME = 'Mestre'

interface Session {
  ws: WebSocket
  name: string
  role: Role
  alive: boolean
}

export interface TableServerOptions {
  port: number
  host?: string
  hostToken: string
  heartbeatMs?: number
}

export interface TableServer {
  readonly port: number
  readonly host: string
  players(): string[]
  getScene(): Scene
  close(): Promise<void>
}

export async function startTableServer(opts: TableServerOptions): Promise<TableServer> {
  const host = opts.host ?? '0.0.0.0'
  const sessions = new Set<Session>()
  const scene: Scene = emptyScene()
  const log: LogEntry[] = []

  const http: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(404).end()
  })
  const wss = new WebSocketServer({ server: http, maxPayload: 1024 * 1024 })
  wss.on('error', () => {}) // ws re-emits the http server's errors; listen() below reports them

  const send = (s: Session, msg: ServerMsg): void => {
    if (s.ws.readyState === WebSocket.OPEN) s.ws.send(JSON.stringify(msg))
  }
  const joined = (): Session[] => [...sessions]
  const names = (): string[] => joined().map((s) => s.name)
  const viewFor = (role: Role): View => ({ role, ...scene, players: names() })

  const broadcastPlayers = (except?: Session): void => {
    const players = names()
    for (const s of sessions) if (s !== except) send(s, { t: 'patch', ops: [{ op: 'players', players }] })
  }

  const handleJoin = (ws: WebSocket, msg: Extract<ClientMsg, { t: 'join' }>): Session | null => {
    const isMaster = msg.hostToken !== undefined && msg.hostToken === opts.hostToken
    const name = isMaster ? MASTER_NAME : normalizeName(msg.name)
    const playerCount = joined().filter((s) => s.role === 'player').length
    const reason = isMaster
      ? joined().some((s) => s.role === 'master')
        ? 'Nome já em uso'
        : null
      : validateJoin(name, [...names(), MASTER_NAME], playerCount)
    if (reason) {
      ws.send(JSON.stringify({ t: 'join-error', reason } satisfies ServerMsg))
      ws.close(4000, reason)
      return null
    }
    const session: Session = { ws, name, role: isMaster ? 'master' : 'player', alive: true }
    sessions.add(session)
    send(session, { t: 'welcome', you: { role: session.role, name }, view: viewFor(session.role), log: log.slice(-200) })
    broadcastPlayers(session)
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
    })
    ws.on('close', () => {
      if (session && sessions.delete(session)) broadcastPlayers()
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
    getScene: () => scene,
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
