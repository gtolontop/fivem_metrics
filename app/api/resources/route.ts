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

  // IP collection progress (phase 1) - cap at 100%
  const ipProgress = stats.totalServers > 0
    ? Math.min(100, Math.round((stats.totalWithIp / stats.totalServers) * 100))
    : 0

  // Scan progress (phase 2) - based on pending vs scanned, cap at 100%
  // Use: scanned / (scanned + pending) for accurate progress
  const totalToScan = totalScanned + stats.pendingScan
  const scanProgress = totalToScan > 0
    ? Math.min(100, Math.round((totalScanned / totalToScan) * 100))
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
