import { NextResponse } from 'next/server'
import { getServerInfoDirect } from '@/lib/fivem'
import {
  getCache,
  addScannedServer,
  getScannedCount,
  getIpMappingCount,
  getServersWithIp
} from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Fast scan - hit servers directly using cached IP mappings
const BATCH_SIZE = 100 // Can go fast since no central rate limit!

export async function GET() {
  const cache = getCache()

  if (cache.servers.length === 0) {
    return NextResponse.json({
      message: 'No servers in cache',
      scanned: 0,
      total: 0,
      resources: 0
    })
  }

  const ipMappingCount = getIpMappingCount()
  if (ipMappingCount === 0) {
    return NextResponse.json({
      message: 'No IP mappings yet. Call /api/build-ips first to build up IP database.',
      scanned: 0,
      total: cache.servers.length,
      resources: 0,
      needIps: true
    })
  }

  // Get servers with IP that haven't been scanned yet
  const serversWithIp = getServersWithIp()
    .filter(({ server }) => !cache.scannedServerIds.has(server.id))
    .slice(0, BATCH_SIZE)

  if (serversWithIp.length === 0) {
    return NextResponse.json({
      message: 'All servers with IPs have been scanned',
      scanned: getScannedCount(),
      total: cache.servers.length,
      ipsKnown: ipMappingCount,
      resources: cache.resources.length,
      complete: getScannedCount() >= ipMappingCount
    })
  }

  // Scan in parallel - each server is independent!
  const startTime = Date.now()
  let successCount = 0

  const promises = serversWithIp.map(async ({ server, ip }) => {
    const info = await getServerInfoDirect(ip)
    if (info && info.resources.length > 0) {
      addScannedServer(server.id, info.resources, server.players)
      successCount++
    } else {
      addScannedServer(server.id, [], server.players)
    }
  })

  await Promise.all(promises)

  const elapsed = Date.now() - startTime

  return NextResponse.json({
    message: `Scanned ${successCount}/${serversWithIp.length} servers in ${elapsed}ms`,
    scanned: getScannedCount(),
    ipsKnown: ipMappingCount,
    total: cache.servers.length,
    resources: cache.resources.length,
    progress: Math.round((getScannedCount() / ipMappingCount) * 100),
    speed: `${Math.round(serversWithIp.length / (elapsed / 1000))} servers/sec`
  })
}
