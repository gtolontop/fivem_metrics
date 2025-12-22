import { NextResponse } from 'next/server'
import { getCache, getScannedCount, getIpMappingCount as getLocalIpCount, loadResourcesFromRedis } from '@/lib/cache'
import {
  isRedisEnabled,
  getRedisStats,
  getOnlineServerCount,
  getScannedServerCount
} from '@/lib/redis'
import { runScan, getScanStatus } from '@/lib/background-scanner'
import { collectIpBatch, getCollectorStatus } from '@/lib/ip-collector'

export const dynamic = 'force-dynamic'

// Track last scan/collect time to avoid spamming
let lastScanTime = 0
let lastCollectTime = 0
const SCAN_INTERVAL = 60 * 1000 // 1 minute
const COLLECT_INTERVAL = 30 * 1000 // 30 seconds

export async function GET() {
  // Load resources from Redis on first call
  await loadResourcesFromRedis()

  // Auto-collect IPs if needed (every 30s)
  const now = Date.now()
  if (isRedisEnabled() && now - lastCollectTime > COLLECT_INTERVAL) {
    lastCollectTime = now
    collectIpBatch().catch(() => {}) // Don't wait
  }

  // Auto-scan if we have IPs and haven't scanned recently
  if (isRedisEnabled() && now - lastScanTime > SCAN_INTERVAL) {
    lastScanTime = now
    runScan().catch(() => {}) // Don't wait
  }

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
