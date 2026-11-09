import { networkInterfaces, type NetworkInterfaceInfo } from 'node:os'

export type AddressLabel = 'Hamachi' | 'Radmin' | 'Rede'
export interface LanAddress {
  ip: string
  label: AddressLabel
}

type Ifaces = NodeJS.Dict<NetworkInterfaceInfo[]>

function labelFor(ip: string): AddressLabel {
  if (ip.startsWith('25.')) return 'Hamachi'
  if (ip.startsWith('26.')) return 'Radmin'
  return 'Rede'
}

/** NET-03: the machine's IPv4 addresses (no loopback), VPN addresses first. */
export function listAddresses(ifaces: Ifaces = testIfaces() ?? networkInterfaces()): LanAddress[] {
  const out: LanAddress[] = []
  for (const list of Object.values(ifaces)) {
    for (const i of list ?? []) {
      if (i.family !== 'IPv4' || i.internal) continue
      out.push({ ip: i.address, label: labelFor(i.address) })
    }
  }
  const rank = { Hamachi: 0, Radmin: 1, Rede: 2 }
  return out.sort((a, b) => rank[a.label] - rank[b.label])
}

/** In tests (MESA_TEST=1), MESA_TEST_IFACES replaces the OS interfaces with a JSON list of IPv4 strings. */
function testIfaces(): Ifaces | null {
  if (process.env.MESA_TEST !== '1' || !process.env.MESA_TEST_IFACES) return null
  const ips = JSON.parse(process.env.MESA_TEST_IFACES) as string[]
  return {
    test: ips.map((address) => ({ address, family: 'IPv4', internal: false, netmask: '255.0.0.0', mac: '00:00:00:00:00:00', cidr: null }))
  }
}
