import { NextRequest, NextResponse } from 'next/server'
import { getCache, isCacheValid } from '@/lib/cache'
import { getQueueStats, isQueueEnabled } from '@/lib/queue'
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

/**
 * GET /api/servers - Paginated server list with pre-calculated stats
 * Query params:
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
 *   - q: search query (optional)
 */
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimit = applyRateLimit(request, RATE_LIMITS.api)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')
  const query = searchParams.get('q')?.toLowerCase().trim() || ''

  const cache = getCache()

  // If cache is empty, return empty state
  if (!isCacheValid() || cache.servers.length === 0) {
    return NextResponse.json({
      servers: [],
      total: 0,
      totalPlayers: 0,
      totalServers: 0,
      hasMore: false,
      offset,
      limit
    }, {
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }

  // Get stats from Redis if available
  const stats = isQueueEnabled() ? await getQueueStats() : null

  // Filter servers if query provided
  let filteredServers = cache.servers
  if (query) {
    filteredServers = cache.servers.filter(s => {
      const name = s.name?.toLowerCase() || ''
      const game = s.gametype?.toLowerCase() || ''
      const tags = s.tags?.toLowerCase() || ''
      return name.includes(query) || game.includes(query) || tags.includes(query)
    })
  }

  // Paginate
  const paginatedServers = filteredServers.slice(offset, offset + limit)
  const hasMore = offset + limit < filteredServers.length

  return NextResponse.json({
    servers: paginatedServers,
    total: filteredServers.length,
    totalPlayers: cache.totalPlayers,
    totalServers: cache.totalServers,
    serversOnline: stats?.totalOnline ?? filteredServers.length,
    hasMore,
    offset,
    limit
  }, {
    headers: { ...corsHeaders, ...rateLimit.headers }
  })
}
