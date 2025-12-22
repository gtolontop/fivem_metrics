import { NextResponse } from 'next/server'
import { getCache, getScannedCount } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cache = getCache()

  return NextResponse.json({
    resources: cache.resources,
    totalResources: cache.resources.length,
    serversScanned: getScannedCount(),
    totalServers: cache.servers.length,
    scanProgress: cache.servers.length > 0
      ? Math.round((getScannedCount() / cache.servers.length) * 100)
      : 0
  })
}
