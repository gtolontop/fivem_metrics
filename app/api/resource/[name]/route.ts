import { NextResponse } from 'next/server'
import { getCache } from '@/lib/cache'
import { getServersWithResource, getQueueStats, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const resourceName = decodeURIComponent(name)

  if (!isQueueEnabled()) {
    return NextResponse.json({
      error: 'Redis not configured',
      name: resourceName,
      servers: [],
      serverCount: 0
    }, { status: 503 })
  }

  const cache = getCache()
  const [serverIds, stats] = await Promise.all([
    getServersWithResource(resourceName),
    getQueueStats()
  ])

  if (serverIds.length === 0) {
    return NextResponse.json({
      name: resourceName,
      servers: [],
      serverCount: 0,
      totalPlayers: 0,
      scanProgress: stats.totalWithIp > 0
        ? Math.round(((stats.totalOnline + stats.totalOffline + stats.totalUnavailable) / stats.totalWithIp) * 100)
        : 0
    })
  }

  // Get server details from cache
  const serversWithResource = serverIds
    .map(serverId => {
      const server = cache.servers.find(s => s.id === serverId)
      if (!server) return null
      return {
        id: server.id,
        name: server.name,
        players: server.players,
        maxPlayers: server.maxPlayers,
        gametype: server.gametype
      }
    })
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .sort((a, b) => b.players - a.players)

  const totalPlayers = serversWithResource.reduce((sum, s) => sum + s.players, 0)
  const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable

  return NextResponse.json({
    name: resourceName,
    servers: serversWithResource,
    serverCount: serversWithResource.length,
    totalPlayers,
    scanProgress: stats.totalWithIp > 0
      ? Math.round((totalScanned / stats.totalWithIp) * 100)
      : 0
  })
}
