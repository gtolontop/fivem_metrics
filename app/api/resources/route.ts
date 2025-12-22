import { NextResponse } from 'next/server'
import { getServersDirect, getServerDetails, FiveMResource } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get top servers from bulk stream
    const { servers } = await getServersDirect()

    // Fetch details for top 50 servers to get their resources
    const topServers = servers.slice(0, 50)

    const resourceMap = new Map<string, FiveMResource>()

    // Fetch details in parallel (batches of 10)
    for (let i = 0; i < topServers.length; i += 10) {
      const batch = topServers.slice(i, i + 10)
      const details = await Promise.all(
        batch.map(s => getServerDetails(s.id))
      )

      for (const server of details) {
        if (!server) continue
        for (const r of server.resources) {
          if (!r || r.length < 2) continue
          const existing = resourceMap.get(r) || { name: r, servers: 0, players: 0 }
          existing.servers++
          existing.players += server.players
          resourceMap.set(r, existing)
        }
      }
    }

    const resources = Array.from(resourceMap.values())
      .sort((a, b) => b.servers - a.servers)

    return NextResponse.json({
      resources,
      totalResources: resources.length,
      serversScanned: topServers.length
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ resources: [], totalResources: 0, serversScanned: 0 })
  }
}
