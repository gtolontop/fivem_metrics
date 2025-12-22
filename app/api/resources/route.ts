import { NextResponse } from 'next/server'
import { getResources, getQueueStats, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isQueueEnabled()) {
    return NextResponse.json({
      error: 'Redis not configured',
      resources: [],
      totalResources: 0,
      serversScanned: 0,
      totalServers: 0,
      scanProgress: 0,
      ipProgress: 0,
      serversWithIp: 0
    }, { status: 503 })
  }

  const [resources, stats] = await Promise.all([
    getResources(),
    getQueueStats()
  ])

  const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable

  // IP collection progress (phase 1)
  const ipProgress = stats.totalServers > 0
    ? Math.round((stats.totalWithIp / stats.totalServers) * 100)
    : 0

  // Scan progress (phase 2 - only servers with IPs)
  const scanProgress = stats.totalWithIp > 0
    ? Math.round((totalScanned / stats.totalWithIp) * 100)
    : 0

  return NextResponse.json({
    resources,
    totalResources: resources.length,
    serversScanned: totalScanned,
    serversWithIp: stats.totalWithIp,
    totalServers: stats.totalServers,
    serversOnline: stats.totalOnline,
    pendingIpFetch: stats.pendingIpFetch,
    pendingScan: stats.pendingScan,
    ipProgress,
    scanProgress
  })
}
