import { NextResponse } from 'next/server'
import { getQueueStats, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const stats = await getQueueStats()

  const totalWithStatus = stats.totalOnline + stats.totalOffline + stats.totalUnavailable
  const ipProgress = stats.totalServers > 0
    ? Math.round((stats.totalWithIp / stats.totalServers) * 100)
    : 0
  const scanProgress = stats.totalWithIp > 0
    ? Math.round((totalWithStatus / stats.totalWithIp) * 100)
    : 0

  return NextResponse.json({
    queues: {
      pendingIpFetch: stats.pendingIpFetch,
      pendingScan: stats.pendingScan,
      processing: stats.processing
    },
    servers: {
      total: stats.totalServers,
      withIp: stats.totalWithIp,
      online: stats.totalOnline,
      offline: stats.totalOffline,
      unavailable: stats.totalUnavailable,
      ipProgress: `${ipProgress}%`,
      scanProgress: `${scanProgress}%`
    },
    estimate: {
      // Avec 50 workers à 150 IPs/min chacun = 7500 IPs/min
      minutesToCompleteIps: Math.ceil(stats.pendingIpFetch / 7500),
      // Scan direct = ~200 serveurs/sec = 12000/min
      minutesToCompleteScan: Math.ceil(stats.pendingScan / 12000)
    }
  })
}
