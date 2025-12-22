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
      scanProgress: 0
    }, { status: 503 })
  }

  const [resources, stats] = await Promise.all([
    getResources(),
    getQueueStats()
  ])

  const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable

  return NextResponse.json({
    resources,
    totalResources: resources.length,
    serversScanned: totalScanned,
    totalServers: stats.totalServers,
    serversOnline: stats.totalOnline,
    scanProgress: stats.totalWithIp > 0
      ? Math.round((totalScanned / stats.totalWithIp) * 100)
      : 0
  })
}
