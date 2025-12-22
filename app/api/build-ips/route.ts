import { NextResponse } from 'next/server'
import { getCache, setIpMapping, getIpMappingCount, getServersWithoutIp } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Build up IP mappings by fetching from FiveM API (rate limited, do slowly)
const BATCH_SIZE = 3 // Small batch to avoid rate limit

export async function GET() {
  const cache = getCache()

  if (cache.servers.length === 0) {
    return NextResponse.json({
      message: 'No servers in cache',
      mappings: 0,
      total: 0
    })
  }

  // Get servers without IP mapping
  const needIp = getServersWithoutIp().slice(0, BATCH_SIZE)

  if (needIp.length === 0) {
    return NextResponse.json({
      message: 'All servers have IP mappings',
      mappings: getIpMappingCount(),
      total: cache.servers.length,
      complete: true
    })
  }

  // Fetch from FiveM API (rate limited)
  let successCount = 0
  for (const server of needIp) {
    try {
      const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${server.id}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      })

      if (res.ok) {
        const data = await res.json()
        const endpoints = data.Data?.connectEndPoints
        if (endpoints && endpoints.length > 0) {
          setIpMapping(server.id, endpoints[0])
          successCount++
        }
      }
    } catch {
      // Rate limited or error, continue
    }
  }

  return NextResponse.json({
    message: `Got ${successCount} IP mappings`,
    mappings: getIpMappingCount(),
    total: cache.servers.length,
    progress: Math.round((getIpMappingCount() / cache.servers.length) * 100)
  })
}
