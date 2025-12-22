import { NextResponse } from 'next/server'
import { getCache, getScannedCount } from '@/lib/cache'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const resourceName = decodeURIComponent(name)

  const cache = getCache()
  const resourceData = cache.resourceDetails.get(resourceName)

  if (!resourceData) {
    return NextResponse.json({
      name: resourceName,
      servers: [],
      serverCount: 0,
      totalPlayers: 0,
      scanProgress: cache.servers.length > 0
        ? Math.round((getScannedCount() / cache.servers.length) * 100)
        : 0
    })
  }

  // Get server details from cache
  const serversWithResource = resourceData.servers
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

  return NextResponse.json({
    name: resourceName,
    servers: serversWithResource,
    serverCount: serversWithResource.length,
    totalPlayers,
    scanProgress: Math.round((getScannedCount() / cache.servers.length) * 100)
  })
}
