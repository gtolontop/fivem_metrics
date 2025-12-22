import { NextResponse } from 'next/server'
import { getCache, getScannedCount, getIpMappingCount as getLocalIpCount } from '@/lib/cache'
import {
  isRedisEnabled,
  getRedisStats,
  getOnlineServerCount
} from '@/lib/redis'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cache = getCache()

  // Get stats from Redis or local
  let ipCount: number
  let scannedCount: number
  let onlineCount: number
  let storage: string

  if (isRedisEnabled()) {
    const stats = await getRedisStats()
    ipCount = stats.ipMappings
    scannedCount = stats.scannedServers
    onlineCount = await getOnlineServerCount()
    storage = 'redis'
  } else {
    ipCount = getLocalIpCount()
    scannedCount = getScannedCount()
    onlineCount = 0
    storage = 'file'
  }

  const totalServers = cache.servers.length
  const ipProgress = totalServers > 0 ? Math.round((ipCount / totalServers) * 100) : 0
  const scanProgress = ipCount > 0 ? Math.round((scannedCount / ipCount) * 100) : 0

  return NextResponse.json({
    storage,
    servers: {
      total: totalServers,
      withIp: ipCount,
      scanned: scannedCount,
      online: onlineCount,
      ipProgress: `${ipProgress}%`,
      scanProgress: `${scanProgress}%`
    },
    resources: {
      total: cache.resources.length
    },
    // Estimation du temps restant
    estimate: {
      needIp: totalServers - ipCount,
      needScan: ipCount - scannedCount,
      // Avec 50 workers, ~150 IPs chacun par run
      workersNeeded: Math.ceil((totalServers - ipCount) / 150),
      runsNeeded: Math.ceil((totalServers - ipCount) / 7500) // 50 workers x 150
    },
    lastUpdate: new Date(cache.lastUpdate).toISOString()
  })
}
