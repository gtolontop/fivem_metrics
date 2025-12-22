import { NextResponse } from 'next/server'
import { getServerDetails } from '@/lib/fivem'
import { getCache, getUnscannedServers, addScannedServer, getScannedCount, shouldScanResources } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Progressive scan - fetch 3 servers per call to avoid rate limiting
const BATCH_SIZE = 3
const DELAY_BETWEEN = 500 // 500ms between each server fetch

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function GET() {
  const cache = getCache()

  // Don't scan if no servers cached
  if (cache.servers.length === 0) {
    return NextResponse.json({
      message: 'No servers in cache',
      scanned: 0,
      total: 0,
      resources: 0
    })
  }

  // Check if we should scan (rate limit self)
  if (!shouldScanResources()) {
    return NextResponse.json({
      message: 'Scan rate limited',
      scanned: getScannedCount(),
      total: cache.servers.length,
      resources: cache.resources.length,
      nextScan: 'soon'
    })
  }

  // Get unscanned servers
  const toScan = getUnscannedServers(BATCH_SIZE)

  if (toScan.length === 0) {
    return NextResponse.json({
      message: 'All servers scanned',
      scanned: getScannedCount(),
      total: cache.servers.length,
      resources: cache.resources.length,
      complete: true
    })
  }

  // Scan servers one by one with delay
  let successCount = 0
  for (const server of toScan) {
    try {
      const details = await getServerDetails(server.id)
      if (details && details.resources.length > 0) {
        addScannedServer(server.id, details.resources, server.players)
        successCount++
      } else {
        // Mark as scanned even if no resources
        addScannedServer(server.id, [], server.players)
      }
      await sleep(DELAY_BETWEEN)
    } catch (e) {
      console.error('Failed to scan server:', server.id, e)
      // On rate limit, stop scanning
      break
    }
  }

  return NextResponse.json({
    message: `Scanned ${successCount} servers`,
    scanned: getScannedCount(),
    total: cache.servers.length,
    resources: cache.resources.length,
    progress: Math.round((getScannedCount() / cache.servers.length) * 100)
  })
}
