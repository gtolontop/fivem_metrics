import { NextResponse } from 'next/server'
import { getCache } from '@/lib/cache'
import { getQueueStats, getResources, isQueueEnabled } from '@/lib/queue'
import { autoInit } from '@/lib/auto-init'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Auto-init tout au premier appel
  if (isQueueEnabled()) {
    await autoInit()
  }

  const cache = getCache()

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
      system: 'queue',
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
        minutesToCompleteIps: Math.ceil(stats.pendingIpFetch / 7500),
        workersNeeded: Math.ceil(stats.pendingIpFetch / 150)
      },
      lastUpdate: cache.lastUpdate > 0 ? new Date(cache.lastUpdate).toISOString() : null
    })
  }

  return NextResponse.json({
    system: 'local',
    error: 'Redis not configured',
    servers: {
      total: cache.servers.length
    }
  })
}
