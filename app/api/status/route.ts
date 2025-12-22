import { NextResponse } from 'next/server'
import { getCache, getScannedCount, getIpMappingCount as getLocalIpCount } from '@/lib/cache'
import {
  isRedisEnabled,
  getRedisStats,
  getOnlineServerCount
} from '@/lib/redis'
import { getScanStatus } from '@/lib/background-scanner'
import { getCollectorStatus } from '@/lib/ip-collector'

export const dynamic = 'force-dynamic'

// Background services now start automatically via instrumentation.ts

export async function GET() {

  const cache = getCache()
  const bgStatus = getScanStatus()
  const collectorStatus = getCollectorStatus()

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
    backgroundScanner: {
      running: bgStatus.isScanning,
      lastScan: bgStatus.lastScanTime > 0 ? new Date(bgStatus.lastScanTime).toISOString() : null,
      serversWithIp: bgStatus.serversWithIp
    },
    ipCollector: {
      running: collectorStatus.running,
      collecting: collectorStatus.isCollecting,
      collected: collectorStatus.totalCollected
    },
    estimate: {
      needIp: totalServers - ipCount,
      needScan: ipCount - scannedCount,
      workersNeeded: Math.ceil((totalServers - ipCount) / 150),
      runsNeeded: Math.ceil((totalServers - ipCount) / 7500)
    },
    lastUpdate: new Date(cache.lastUpdate).toISOString()
  })
}
