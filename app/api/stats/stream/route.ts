import { getResources, getQueueStats, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// SSE endpoint for real-time stats updates
export async function GET() {
  if (!isQueueEnabled()) {
    return new Response('Redis not configured', { status: 503 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const sendStats = async () => {
        try {
          const [resources, stats] = await Promise.all([
            getResources(),
            getQueueStats()
          ])

          const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable
          const totalToScan = totalScanned + stats.pendingScan

          const data = {
            resources: resources.slice(0, 100), // Top 100 for perf
            totalResources: resources.length,
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

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch (e) {
          console.error('[SSE] Error:', e)
        }
      }

      // Send immediately
      await sendStats()

      // Then every 2 seconds
      const interval = setInterval(sendStats, 2000)

      // Cleanup on close
      const cleanup = () => {
        clearInterval(interval)
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      // Handle client disconnect (controller will error on enqueue)
      setTimeout(() => {
        // Max connection time: 5 minutes, then client should reconnect
        cleanup()
      }, 5 * 60 * 1000)
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  })
}
