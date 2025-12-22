import { NextResponse } from 'next/server'
import { getCache } from '@/lib/cache'
import { getQueueStats, getResources, isQueueEnabled, initializeQueues, queueServersForScan } from '@/lib/queue'

export const dynamic = 'force-dynamic'

// Track initialization
let initialized = false
let lastInitTime = 0
const INIT_INTERVAL = 5 * 60 * 1000 // Re-init queues every 5 minutes

export async function GET() {
  const cache = getCache()

  // Auto-initialize queues if we have servers
  const now = Date.now()
  if (isQueueEnabled() && cache.servers.length > 0 && (
    !initialized || now - lastInitTime > INIT_INTERVAL
  )) {
    initialized = true
    lastInitTime = now

    // Initialize queues in background
    initializeQueues(cache.servers.map(s => s.id)).catch(console.error)
    queueServersForScan().catch(console.error)
  }

  // Get stats from new queue system
  if (isQueueEnabled()) {
    const [stats, resources] = await Promise.all([
      getQueueStats(),
      getResources()
    ])

    const totalWithStatus = stats.totalOnline + stats.totalOffline + stats.totalUnavailable
    const ipProgress = stats.totalServers > 0
      ? Math.round((stats.totalWithIp / stats.totalServers) * 100)
      : 0
    const scanProgress = stats.totalWithIp > 0
      ? Math.round((totalWithStatus / stats.totalWithIp) * 100)
      : 0

    return NextResponse.json({
      system: 'queue', // Nouveau système
      queues: {
        pendingIpFetch: stats.pendingIpFetch,
        pendingScan: stats.pendingScan,
        processing: stats.processing
      },
      servers: {
        total: stats.totalServers || cache.servers.length,
        withIp: stats.totalWithIp,
        online: stats.totalOnline,
        offline: stats.totalOffline,
        unavailable: stats.totalUnavailable,
        ipProgress: `${ipProgress}%`,
        scanProgress: `${scanProgress}%`
      },
      resources: {
        total: resources.length
      },
      estimate: {
        needIp: stats.pendingIpFetch,
        needScan: stats.pendingScan,
        // Avec 50 workers à 150 IPs/min chacun = 7500 IPs/min
        minutesToCompleteIps: Math.ceil(stats.pendingIpFetch / 7500),
        workersNeeded: Math.ceil(stats.pendingIpFetch / 150)
      },
      lastUpdate: new Date(cache.lastUpdate).toISOString()
    })
  }

  // Fallback si Redis pas dispo
  return NextResponse.json({
    system: 'local',
    error: 'Redis not configured - queue system unavailable',
    servers: {
      total: cache.servers.length,
      cached: cache.servers.length > 0
    },
    lastUpdate: new Date(cache.lastUpdate).toISOString()
  })
}
