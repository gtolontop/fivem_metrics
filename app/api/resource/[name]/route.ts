import { NextResponse } from 'next/server'
import { getServersByIds } from '@/lib/cache'
import { getServersWithResource, getQueueStats, getResources, isQueueEnabled } from '@/lib/queue'
import { applyRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// CORS headers for public API access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

// Extract prefix from resource name (e.g., "qb-core" -> "qb-", "esx_society" -> "esx_")
function extractPrefix(name: string): string | null {
  // Common patterns: word followed by - or _
  const match = name.match(/^([a-zA-Z0-9]+[-_])/)
  if (match && match[1].length >= 2 && match[1].length <= 15) {
    return match[1]
  }
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  // Apply rate limiting
  const rateLimit = applyRateLimit(request, RATE_LIMITS.api)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { name } = await params
  const resourceName = decodeURIComponent(name)

  if (!isQueueEnabled()) {
    return NextResponse.json({
      error: 'Redis not configured',
      name: resourceName,
      servers: [],
      serverCount: 0
    }, {
      status: 503,
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }

  const [serverIds, stats, allResources] = await Promise.all([
    getServersWithResource(resourceName),
    getQueueStats(),
    getResources()
  ])

  // Find related resources with same prefix
  const prefix = extractPrefix(resourceName)
  let relatedResources: Array<{ name: string, servers: number, players: number }> = []

  if (prefix) {
    relatedResources = allResources
      .filter(r => r.name.startsWith(prefix) && r.name !== resourceName)
      .slice(0, 10)  // Top 10 related
      .map(r => ({ name: r.name, servers: r.servers, players: r.players }))
  }

  // Get the resource's own stats from aggregated data
  const resourceStats = allResources.find(r => r.name === resourceName)

  if (serverIds.length === 0 && !resourceStats) {
    return NextResponse.json({
      name: resourceName,
      servers: [],
      serverCount: 0,
      totalPlayers: 0,
      prefix: prefix,
      relatedResources: [],
      scanProgress: stats.totalWithIp > 0
        ? Math.round(((stats.totalOnline + stats.totalOffline + stats.totalUnavailable) / stats.totalWithIp) * 100)
        : 0
    }, {
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }

  // Get server details from cache using O(1) Map lookup
  const servers = getServersByIds(serverIds)
  const serversWithResource = servers
    .map(server => ({
      id: server.id,
      name: server.name,
      players: server.players,
      maxPlayers: server.maxPlayers,
      gametype: server.gametype
    }))
    .sort((a, b) => b.players - a.players)

  const totalPlayers = serversWithResource.reduce((sum, s) => sum + s.players, 0)
  const totalScanned = stats.totalOnline + stats.totalOffline + stats.totalUnavailable

  return NextResponse.json({
    name: resourceName,
    servers: serversWithResource,
    serverCount: resourceStats?.servers ?? serversWithResource.length,
    onlineServers: resourceStats?.onlineServers ?? serversWithResource.length,
    totalPlayers: resourceStats?.players ?? totalPlayers,
    prefix: prefix,
    relatedResources: relatedResources,
    scanProgress: stats.totalWithIp > 0
      ? Math.round((totalScanned / stats.totalWithIp) * 100)
      : 0
  }, {
    headers: { ...corsHeaders, ...rateLimit.headers }
  })
}
