import { FiveMResource, FiveMServerSlim } from './fivem'

interface CacheData {
  servers: FiveMServerSlim[]
  resources: FiveMResource[]
  resourceDetails: Map<string, { servers: string[], players: number }>
  totalPlayers: number
  totalServers: number
  lastUpdate: number
  lastResourceScan: number
  scannedServerIds: Set<string>
  // cfx ID -> real IP mapping (builds up over time)
  ipMappings: Map<string, string>
}

// Use globalThis to persist cache across Next.js hot reloads
const globalCache = globalThis as unknown as { __fivemCache?: CacheData }

if (!globalCache.__fivemCache) {
  globalCache.__fivemCache = {
    servers: [],
    resources: [],
    resourceDetails: new Map(),
    totalPlayers: 0,
    totalServers: 0,
    lastUpdate: 0,
    lastResourceScan: 0,
    scannedServerIds: new Set(),
    ipMappings: new Map()
  }
}

const cache = globalCache.__fivemCache

const CACHE_TTL = 60 * 1000 // 1 minute for server list
const RESOURCE_SCAN_INTERVAL = 5 * 1000 // 5 seconds between scan batches

export function getCache(): CacheData {
  return cache
}

export function isCacheValid(): boolean {
  return Date.now() - cache.lastUpdate < CACHE_TTL && cache.servers.length > 0
}

export function shouldScanResources(): boolean {
  return Date.now() - cache.lastResourceScan > RESOURCE_SCAN_INTERVAL
}

export function updateServers(
  servers: FiveMServerSlim[],
  totalPlayers: number,
  totalServers: number
): void {
  cache.servers = servers
  cache.totalPlayers = totalPlayers
  cache.totalServers = totalServers
  cache.lastUpdate = Date.now()
  console.log('Cache updated:', servers.length, 'servers')
}

export function updateResources(resources: FiveMResource[]): void {
  cache.resources = resources
}

export function addScannedServer(serverId: string, resources: string[], players: number): void {
  cache.scannedServerIds.add(serverId)

  for (const r of resources) {
    if (!r || r.length < 2) continue
    const existing = cache.resourceDetails.get(r) || { servers: [], players: 0 }
    if (!existing.servers.includes(serverId)) {
      existing.servers.push(serverId)
      existing.players += players
    }
    cache.resourceDetails.set(r, existing)
  }

  // Update aggregated resources list
  cache.resources = Array.from(cache.resourceDetails.entries())
    .map(([name, data]) => ({
      name,
      servers: data.servers.length,
      players: data.players
    }))
    .sort((a, b) => b.servers - a.servers)

  cache.lastResourceScan = Date.now()
}

export function getUnscannedServers(limit: number): FiveMServerSlim[] {
  return cache.servers
    .filter(s => !cache.scannedServerIds.has(s.id))
    .slice(0, limit)
}

export function getScannedCount(): number {
  return cache.scannedServerIds.size
}

export function resetScan(): void {
  cache.scannedServerIds.clear()
  cache.resourceDetails.clear()
  cache.resources = []
  cache.lastResourceScan = 0
}

// IP mapping functions
export function setIpMapping(cfxId: string, realIp: string): void {
  cache.ipMappings.set(cfxId, realIp)
}

export function getIpMapping(cfxId: string): string | undefined {
  return cache.ipMappings.get(cfxId)
}

export function getIpMappingCount(): number {
  return cache.ipMappings.size
}

export function getServersWithoutIp(): FiveMServerSlim[] {
  return cache.servers.filter(s => !cache.ipMappings.has(s.id))
}

export function getServersWithIp(): Array<{ server: FiveMServerSlim, ip: string }> {
  return cache.servers
    .filter(s => cache.ipMappings.has(s.id))
    .map(s => ({ server: s, ip: cache.ipMappings.get(s.id)! }))
}
