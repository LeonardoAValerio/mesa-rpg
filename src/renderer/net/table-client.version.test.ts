import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer, WebSocket as WsClient } from 'ws'
import { startTableServer, type TableServer } from '../../main/table-server'
import { TableClient } from './table-client'

let table: TableServer | null = null
let fake: WebSocketServer | null = null
let client: TableClient | null = null

afterEach(async () => {
  client?.close()
  await table?.close()
  if (fake) {
    for (const c of fake.clients) c.terminate()
    await new Promise<void>((r) => fake!.close(() => r()))
  }
  table = fake = client = null
})

async function until(cond: () => boolean, what: string): Promise<void> {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > 3000) throw new Error(`timeout: ${what}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

/** A master that accepts any join and answers with a welcome carrying `version` (absent when undefined). */
async function fakeMaster(version: string | undefined): Promise<{ port: number; joins: unknown[]; open: () => number }> {
  const joins: unknown[] = []
  fake = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  await new Promise<void>((r) => fake!.once('listening', () => r()))
  fake.on('connection', (ws) => {
    ws.on('message', (d) => {
      joins.push(JSON.parse(d.toString()))
      const view = { map: null, grid: null, tokens: {}, fog: null, players: ['Ana'], palette: {} }
      ws.send(JSON.stringify({ t: 'welcome', you: { role: 'player', name: 'Ana' }, view, log: [], ...(version ? { version } : {}) }))
    })
  })
  return {
    port: (fake.address() as { port: number }).port,
    joins,
    open: () => [...fake!.clients].filter((c) => c.readyState === WsClient.OPEN).length
  }
}

describe('TableClient version check', () => {
  it('[C17] VER-03 leaves a master whose welcome has no version or another one, with the message and "desconhecida" when absent', async () => {
    // A 0.1.0 master: it checks nothing and its welcome carries no version.
    table = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't' })
    client = new TableClient({ ip: '127.0.0.1', port: table.port, name: 'Ana', version: '0.2.0', WebSocketImpl: WsClient as never })
    const noVersion = 'Versão diferente da do mestre: mestre desconhecida, você 0.2.0. Atualize o app.'
    await expect(client.connect()).rejects.toThrow(noVersion)
    expect(client.status).toEqual({ kind: 'error', message: noVersion })
    await until(() => table!.players().length === 0, 'the player left the old master')
    client.close()

    // A master on another version that let the join through.
    const m = await fakeMaster('0.3.0')
    client = new TableClient({ ip: '127.0.0.1', port: m.port, name: 'Ana', version: '0.2.0', WebSocketImpl: WsClient as never })
    const other = 'Versão diferente da do mestre: mestre 0.3.0, você 0.2.0. Atualize o app.'
    await expect(client.connect()).rejects.toThrow(other)
    expect(client.status).toEqual({ kind: 'error', message: other })
    await until(() => m.open() === 0, 'the player closed the socket')
  })

  it('VER-01 VER-04 sends its version in join and stays on a master with the same version', async () => {
    const m = await fakeMaster('0.2.0')
    client = new TableClient({ ip: '127.0.0.1', port: m.port, name: 'Ana', version: '0.2.0', WebSocketImpl: WsClient as never })
    await client.connect()
    expect(m.joins).toEqual([{ t: 'join', name: 'Ana', version: '0.2.0' }])
    expect(client.status).toEqual({ kind: 'connected' })
  })

  it('VER-01 shows the master refusal of another version as the join error', async () => {
    table = await startTableServer({ port: 0, host: '127.0.0.1', hostToken: 't', version: '0.2.0' })
    client = new TableClient({ ip: '127.0.0.1', port: table.port, name: 'Ana', version: '0.0.9', WebSocketImpl: WsClient as never })
    const msg = 'Versão diferente da do mestre: mestre 0.2.0, você 0.0.9. Atualize o app.'
    await expect(client.connect()).rejects.toThrow(msg)
    expect(client.status).toEqual({ kind: 'error', message: msg })
    expect(table.players()).toEqual([])
  })
})
