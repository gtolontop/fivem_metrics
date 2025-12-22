/**
 * Cache simple pour les serveurs FiveM
 *
 * Stocke seulement la liste des serveurs en mémoire.
 * Tout le reste (IPs, resources, status) est géré par queue.ts dans Redis.
 */

import { FiveMServerSlim } from './fivem'

interface CacheData {
  servers: FiveMServerSlim[]
  totalPlayers: number
  totalServers: number
  lastUpdate: number
}

// Persist cache across Next.js hot reloads
const globalCache = globalThis as unknown as { __fivemCache?: CacheData }

if (!globalCache.__fivemCache) {
  globalCache.__fivemCache = {
    servers: [],
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

export function isCacheValid(): boolean {
  return Date.now() - cache.lastUpdate < CACHE_TTL && cache.servers.length > 0
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
  console.log('[Cache] Updated:', servers.length, 'servers')
}
