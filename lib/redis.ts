import Redis from 'ioredis'

// Redis connection - uses REDIS_URL from Railway
const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL)
  : null

// Keys
const IP_MAPPINGS_KEY = 'fivem:ip_mappings'        // cfxId -> realIp
const IP_TIMESTAMPS_KEY = 'fivem:ip_timestamps'    // cfxId -> timestamp (quand on a fetch l'IP)
const SCANNED_SERVERS_KEY = 'fivem:scanned_servers' // serveurs scannés pour resources
const SERVER_STATUS_KEY = 'fivem:server_status'    // cfxId -> online/offline
const RESOURCES_KEY = 'fivem:resources'

// Config
const IP_REFRESH_HOURS = 24 // Re-fetch IPs après 24h

export function isRedisEnabled(): boolean {
  return redis !== null
}

// IP Mappings
export async function getIpMappingsFromRedis(): Promise<Map<string, string>> {
  if (!redis) return new Map()
  try {
    const data = await redis.hgetall(IP_MAPPINGS_KEY)
    return new Map(Object.entries(data))
  } catch (e) {
    console.error('Redis getIpMappings error:', e)
    return new Map()
  }
}

export async function setIpMappingInRedis(cfxId: string, realIp: string): Promise<void> {
  if (!redis) return
  try {
    await redis.hset(IP_MAPPINGS_KEY, cfxId, realIp)
  } catch (e) {
    console.error('Redis setIpMapping error:', e)
  }
}

export async function setIpMappingsBulk(mappings: Record<string, string>): Promise<void> {
  if (!redis || Object.keys(mappings).length === 0) return
  try {
    const now = Date.now().toString()
    const timestamps: Record<string, string> = {}
    for (const cfxId of Object.keys(mappings)) {
      timestamps[cfxId] = now
    }
    await Promise.all([
      redis.hset(IP_MAPPINGS_KEY, mappings),
      redis.hset(IP_TIMESTAMPS_KEY, timestamps)
    ])
  } catch (e) {
    console.error('Redis setIpMappingsBulk error:', e)
  }
}

// Get servers that need IP refresh (older than IP_REFRESH_HOURS)
export async function getStaleIpServers(serverIds: string[]): Promise<string[]> {
  if (!redis || serverIds.length === 0) return serverIds
  try {
    const timestamps = await redis.hmget(IP_TIMESTAMPS_KEY, ...serverIds)
    const now = Date.now()
    const staleThreshold = IP_REFRESH_HOURS * 60 * 60 * 1000

    return serverIds.filter((id, i) => {
      const ts = timestamps[i]
      if (!ts) return true // No timestamp = needs fetch
      return now - parseInt(ts) > staleThreshold // Stale = needs refresh
    })
  } catch (e) {
    console.error('Redis getStaleIpServers error:', e)
    return serverIds
  }
}

// Mark server as online/offline after scan
export async function setServerStatus(serverId: string, online: boolean): Promise<void> {
  if (!redis) return
  try {
    await redis.hset(SERVER_STATUS_KEY, serverId, online ? '1' : '0')
  } catch (e) {
    console.error('Redis setServerStatus error:', e)
  }
}

export async function getOnlineServerCount(): Promise<number> {
  if (!redis) return 0
  try {
    const statuses = await redis.hgetall(SERVER_STATUS_KEY)
    return Object.values(statuses).filter(s => s === '1').length
  } catch (e) {
    console.error('Redis getOnlineServerCount error:', e)
    return 0
  }
}

export async function getIpMappingCount(): Promise<number> {
  if (!redis) return 0
  try {
    return await redis.hlen(IP_MAPPINGS_KEY)
  } catch (e) {
    console.error('Redis getIpMappingCount error:', e)
    return 0
  }
}

// Scanned servers tracking
export async function addScannedServerToRedis(serverId: string): Promise<void> {
  if (!redis) return
  try {
    await redis.sadd(SCANNED_SERVERS_KEY, serverId)
  } catch (e) {
    console.error('Redis addScannedServer error:', e)
  }
}

export async function isServerScanned(serverId: string): Promise<boolean> {
  if (!redis) return false
  try {
    return await redis.sismember(SCANNED_SERVERS_KEY, serverId) === 1
  } catch (e) {
    console.error('Redis isServerScanned error:', e)
    return false
  }
}

export async function getScannedServerCount(): Promise<number> {
  if (!redis) return 0
  try {
    return await redis.scard(SCANNED_SERVERS_KEY)
  } catch (e) {
    console.error('Redis getScannedServerCount error:', e)
    return 0
  }
}

// Resources storage
export async function saveResourcesToRedis(resources: Array<{ name: string, servers: number, players: number }>): Promise<void> {
  if (!redis) return
  try {
    await redis.set(RESOURCES_KEY, JSON.stringify(resources))
  } catch (e) {
    console.error('Redis saveResources error:', e)
  }
}

export async function getResourcesFromRedis(): Promise<Array<{ name: string, servers: number, players: number }>> {
  if (!redis) return []
  try {
    const data = await redis.get(RESOURCES_KEY)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Redis getResources error:', e)
    return []
  }
}

// Stats
export async function getRedisStats(): Promise<{
  ipMappings: number
  scannedServers: number
  connected: boolean
}> {
  if (!redis) {
    return { ipMappings: 0, scannedServers: 0, connected: false }
  }
  try {
    const [ipMappings, scannedServers] = await Promise.all([
      redis.hlen(IP_MAPPINGS_KEY),
      redis.scard(SCANNED_SERVERS_KEY)
    ])
    return { ipMappings, scannedServers, connected: true }
  } catch (e) {
    console.error('Redis stats error:', e)
    return { ipMappings: 0, scannedServers: 0, connected: false }
  }
}

export default redis
