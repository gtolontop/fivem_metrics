// Auto IP Collector - Runs on Railway to collect IPs automatically
// Collects a few IPs every minute to avoid rate limits

import { getCache } from './cache'
import { isRedisEnabled, setIpMappingsBulk, getIpMappingsFromRedis } from './redis'

const BATCH_SIZE = 10 // Small batch to avoid rate limits
const COLLECT_INTERVAL = 60 * 1000 // Every minute

let isCollecting = false
let collectInterval: ReturnType<typeof setInterval> | null = null
let totalCollected = 0

async function fetchServerIp(serverId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return null
    const data = await res.json()
    const ip = data.Data?.connectEndPoints?.[0]
    return ip && !ip.startsWith('http') ? ip : null
  } catch {
    return null
  }
}

export async function collectIpBatch(): Promise<{ collected: number, total: number }> {
  if (isCollecting || !isRedisEnabled()) {
    return { collected: 0, total: totalCollected }
  }

  isCollecting = true

  try {
    const cache = getCache()
    if (cache.servers.length === 0) {
      return { collected: 0, total: totalCollected }
    }

    // Get existing IPs from Redis
    const existingIps = await getIpMappingsFromRedis()

    // Find servers without IPs
    const serversWithoutIp = cache.servers
      .filter(s => !existingIps.has(s.id))
      .slice(0, BATCH_SIZE)

    if (serversWithoutIp.length === 0) {
      console.log('[IP-COLLECT] All servers have IPs!')
      return { collected: 0, total: totalCollected }
    }

    // Fetch IPs
    const results: Record<string, string> = {}
    for (const server of serversWithoutIp) {
      const ip = await fetchServerIp(server.id)
      if (ip) {
        results[server.id] = ip
      }
      // Small delay between requests
      await new Promise(r => setTimeout(r, 500))
    }

    // Save to Redis
    if (Object.keys(results).length > 0) {
      await setIpMappingsBulk(results)
      totalCollected += Object.keys(results).length
    }

    console.log(`[IP-COLLECT] Got ${Object.keys(results).length}/${serversWithoutIp.length} IPs (Total: ${totalCollected})`)

    return { collected: Object.keys(results).length, total: totalCollected }
  } finally {
    isCollecting = false
  }
}

export function startIpCollector() {
  if (collectInterval || !isRedisEnabled()) return

  console.log('[IP-COLLECT] Starting IP collector')

  collectInterval = setInterval(async () => {
    await collectIpBatch()
  }, COLLECT_INTERVAL)

  // Start immediately
  collectIpBatch()
}

export function stopIpCollector() {
  if (collectInterval) {
    clearInterval(collectInterval)
    collectInterval = null
    console.log('[IP-COLLECT] Stopped IP collector')
  }
}

export function getCollectorStatus() {
  return {
    running: collectInterval !== null,
    isCollecting,
    totalCollected
  }
}
