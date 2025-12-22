import { NextResponse } from 'next/server'
import { getServersWithIp, getCache } from '@/lib/cache'
import { isRedisEnabled, getIpMappingsFromRedis } from '@/lib/redis'

// GET /api/servers-with-ips - Returns all servers that have IPs cached
export async function GET() {
  const cache = getCache()

  // Use Redis if available, otherwise local cache
  if (isRedisEnabled()) {
    const ipMappings = await getIpMappingsFromRedis()

    // Match IPs with server info from cache
    const result = cache.servers
      .filter(s => ipMappings.has(s.id))
      .map(s => ({
        id: s.id,
        ip: ipMappings.get(s.id)!,
        players: s.players
      }))

    return NextResponse.json(result)
  }

  // Fallback to local cache
  const serversWithIp = getServersWithIp()
  const result = serversWithIp.map(({ server, ip }) => ({
    id: server.id,
    ip,
    players: server.players
  }))

  return NextResponse.json(result)
}
