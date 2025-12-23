import { getResources, getQueueStats, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// SSE endpoint for real-time stats updates
// Sends: stats every 2s, resources every 10s (to avoid huge payloads)
export async function GET() {
  if (!isQueueEnabled()) {
    return new Response('Redis not configured', { status: 503 })
  }

  const encoder = new TextEncoder()
  let isClosed = false
  let statsInterval: ReturnType<typeof setInterval> | null = null
  let resourcesInterval: ReturnType<typeof setInterval> | null = null
  let lastResourceCount = 0

  const stream = new ReadableStream({
    async start(controller) {
      // Send stats (lightweight, every 2s)
      const sendStats = async () => {
        if (isClosed) return

        try {
          const stats = await getQueueStats()
          const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable
          const totalToScan = totalScanned + stats.pendingScan

          const data = {
            type: 'stats',
            totalResources: lastResourceCount,
            serversScanned: totalScanned,
            serversWithIp: stats.totalWithIp,
            totalServers: stats.totalServers,
            serversOnline: stats.totalOnline,
            pendingIpFetch: stats.pendingIpFetch,
            pendingScan: stats.pendingScan,
            ipProgress: stats.totalServers > 0
              ? Math.min(100, Math.round((stats.totalWithIp / stats.totalServers) * 100))
              : 0,
            scanProgress: totalToScan > 0
              ? Math.min(100, Math.round((totalScanned / totalToScan) * 100))
              : 0,
            timestamp: Date.now()
          }

          if (!isClosed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }
        } catch (e) {
          if (!isClosed) console.error('[SSE] Stats error:', e)
        }
      }

      // Send resources (only TOP 100 for perf, every 10s)
      const sendResources = async () => {
        if (isClosed) return

        try {
          const resources = await getResources()
          lastResourceCount = resources.length

          const data = {
            type: 'resources',
            resources: resources.slice(0, 100),  // Only top 100 for SSE
            totalResources: resources.length,
            timestamp: Date.now()
          }

          if (!isClosed) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
          }
        } catch (e) {
          if (!isClosed) console.error('[SSE] Resources error:', e)
        }
      }

      // Send resources first (includes all data)
      await sendResources()
      await sendStats()

      // Then intervals
      statsInterval = setInterval(sendStats, 2000)
      resourcesInterval = setInterval(sendResources, 10000)
    },
    cancel() {
      isClosed = true
      if (statsInterval) clearInterval(statsInterval)
      if (resourcesInterval) clearInterval(resourcesInterval)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
