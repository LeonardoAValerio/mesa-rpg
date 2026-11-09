import { describe, expect, it } from 'vitest'
import type { NetworkInterfaceInfo } from 'node:os'
import { listAddresses } from './netinfo'

const v4 = (address: string, internal = false): NetworkInterfaceInfo => ({
  address,
  family: 'IPv4',
  internal,
  netmask: '255.0.0.0',
  mac: '00:00:00:00:00:00',
  cidr: null
})

describe('listAddresses (NET-03)', () => {
  it('labels 25.x as Hamachi, 26.x as Radmin and the rest as Rede, skipping loopback and IPv6, VPN first', () => {
    const ifaces = {
      lo: [v4('127.0.0.1', true)],
      eth0: [v4('192.168.0.10'), { ...v4('fe80::1'), family: 'IPv6' as const, scopeid: 0 }],
      ham0: [v4('25.12.34.56')],
      radmin: [v4('26.1.2.3')]
    }
    expect(listAddresses(ifaces)).toEqual([
      { ip: '25.12.34.56', label: 'Hamachi' },
      { ip: '26.1.2.3', label: 'Radmin' },
      { ip: '192.168.0.10', label: 'Rede' }
    ])
  })
})
