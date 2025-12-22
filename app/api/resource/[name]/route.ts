import { NextResponse } from 'next/server'
import { getServersDirect, getServerDetails } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const resourceName = decodeURIComponent(name)

  try {
    // Get top servers from bulk stream
    const { servers } = await getServersDirect()

    // Fetch details for top 100 servers to find this resource
    const topServers = servers.slice(0, 100)
    const serversWithResource: Array<{
      id: string
      name: string
      players: number
      maxPlayers: number
      gametype: string
    }> = []

    // Fetch details in parallel (batches of 10)
    for (let i = 0; i < topServers.length; i += 10) {
      const batch = topServers.slice(i, i + 10)
      const details = await Promise.all(
        batch.map(s => getServerDetails(s.id))
      )

      for (const server of details) {
        if (!server) continue
        if (server.resources.includes(resourceName)) {
          serversWithResource.push({
            id: server.id,
            name: server.name,
            players: server.players,
            maxPlayers: server.maxPlayers,
            gametype: server.gametype
          })
        }
      }
    }

    // Sort by players
    serversWithResource.sort((a, b) => b.players - a.players)

    const totalPlayers = serversWithResource.reduce((sum, s) => sum + s.players, 0)

    return NextResponse.json({
      name: resourceName,
      servers: serversWithResource,
      serverCount: serversWithResource.length,
      totalPlayers
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ name: resourceName, servers: [], serverCount: 0, totalPlayers: 0 })
  }
}
