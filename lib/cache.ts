import { FiveMResource, FiveMServerSlim } from './fivem'
import { loadIpMappings, saveIpMappings } from './ip-store'
import { isRedisEnabled, saveResourcesToRedis, getResourcesFromRedis } from './redis'

interface CacheData {
  servers: FiveMServerSlim[]
  resources: FiveMResource[]
  resourceDetails: Map<string, { servers: string[], players: number }>
  totalPlayers: number
  totalServers: number
  lastUpdate: number
  lastResourceScan: number
  scannedServerIds: Set<string>
  // cfx ID -> real IP mapping (builds up over time, persisted to disk)
  ipMappings: Map<string, string>
  ipMappingsLoaded: boolean
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
    ipMappings: new Map(),
    ipMappingsLoaded: false
  }
}

const cache = globalCache.__fivemCache

// Load IP mappings from disk on first access
function ensureIpMappingsLoaded() {
  if (!cache.ipMappingsLoaded) {
    try {
      cache.ipMappings = loadIpMappings()
      cache.ipMappingsLoaded = true
    } catch {
      // File operations may fail in edge runtime, use empty map
      cache.ipMappingsLoaded = true
    }
  }
}

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes for server list (longer to survive rate limits)
const RESOURCE_SCAN_INTERVAL = 5 * 1000 // 5 seconds between scan batches

export function getCache(): CacheData {
  return cache
}

export function isCacheValid(): boolean {
  return Date.now() - cache.lastUpdate < CACHE_TTL && cache.servers.length > 0
}

export function hasCachedData(): boolean {
  return cache.servers.length > 0
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

// Debounced Redis save
let saveToRedisTimeout: ReturnType<typeof setTimeout> | null = null

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

  // Debounced save to Redis (every 5 seconds max)
  if (isRedisEnabled()) {
    if (saveToRedisTimeout) clearTimeout(saveToRedisTimeout)
    saveToRedisTimeout = setTimeout(() => {
      saveResourcesToRedis(cache.resources).catch(() => {})
    }, 5000)
  }
}

// Load resources from Redis (call on startup)
export async function loadResourcesFromRedis(): Promise<void> {
  if (!isRedisEnabled()) return
  try {
    const resources = await getResourcesFromRedis()
    if (resources.length > 0) {
      cache.resources = resources
      console.log('Loaded', resources.length, 'resources from Redis')
    }
  } catch (e) {
    console.error('Failed to load resources from Redis:', e)
  }
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

// IP mapping functions (with disk persistence)
let saveTimeout: ReturnType<typeof setTimeout> | null = null

export function setIpMapping(cfxId: string, realIp: string): void {
  ensureIpMappingsLoaded()
  cache.ipMappings.set(cfxId, realIp)

  // Debounced save to disk
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    try {
      saveIpMappings(cache.ipMappings)
    } catch {
      // Ignore save errors
    }
  }, 5000) // Save 5 seconds after last update
}

export function getIpMapping(cfxId: string): string | undefined {
  ensureIpMappingsLoaded()
  return cache.ipMappings.get(cfxId)
}

export function getIpMappingCount(): number {
  ensureIpMappingsLoaded()
  return cache.ipMappings.size
}

export function getServersWithoutIp(): FiveMServerSlim[] {
  ensureIpMappingsLoaded()
  return cache.servers.filter(s => !cache.ipMappings.has(s.id))
}

export function getServersWithIp(): Array<{ server: FiveMServerSlim, ip: string }> {
  ensureIpMappingsLoaded()
  return cache.servers
    .filter(s => cache.ipMappings.has(s.id))
    .map(s => ({ server: s, ip: cache.ipMappings.get(s.id)! }))
}

// Force save IP mappings
export function forceSaveIpMappings(): void {
  try {
    saveIpMappings(cache.ipMappings)
  } catch {
    // Ignore
  }
}
