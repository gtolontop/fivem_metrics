/**
 * Cache simple pour les serveurs FiveM
 *
 * Stocke seulement la liste des serveurs en mémoire.
 * Tout le reste (IPs, resources, status) est géré par queue.ts dans Redis.
 */

import { FiveMServerSlim } from './fivem'

interface CacheData {
  servers: FiveMServerSlim[]
  serverMap: Map<string, FiveMServerSlim>  // O(1) lookup by ID
  totalPlayers: number
  totalServers: number
  lastUpdate: number
}

// Persist cache across Next.js hot reloads
const globalCache = globalThis as unknown as { __fivemCache?: CacheData }

if (!globalCache.__fivemCache) {
  globalCache.__fivemCache = {
    servers: [],
    serverMap: new Map(),
    totalPlayers: 0,
    totalServers: 0,
    lastUpdate: 0
  }
}

const cache = globalCache.__fivemCache

// 5 minutes TTL
const CACHE_TTL = 5 * 60 * 1000

export function getCache(): CacheData {
  return cache
}

/**
 * O(1) server lookup by ID
 */
export function getServerById(id: string): FiveMServerSlim | undefined {
  return cache.serverMap.get(id)
}

/**
 * Batch O(1) server lookup - returns found servers in order
 */
export function getServersByIds(ids: string[]): FiveMServerSlim[] {
  const results: FiveMServerSlim[] = []
  for (const id of ids) {
    const server = cache.serverMap.get(id)
    if (server) results.push(server)
  }
  return results
}

export function isCacheValid(): boolean {
  return Date.now() - cache.lastUpdate < CACHE_TTL && cache.servers.length > 0
}

export function updateServers(
  servers: FiveMServerSlim[],
  totalPlayers: number,
  totalServers: number
): void {
  cache.servers = servers
  // Build Map for O(1) lookups
  cache.serverMap = new Map(servers.map(s => [s.id, s]))
  cache.totalPlayers = totalPlayers
  cache.totalServers = totalServers
  cache.lastUpdate = Date.now()
  console.log('[Cache] Updated:', servers.length, 'servers')
}
