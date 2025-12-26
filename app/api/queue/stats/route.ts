import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const rateLimit = applyRateLimit(request, RATE_LIMITS.api)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, {
      status: 503,
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }

  const stats = await getQueueStats()

  const totalWithStatus = stats.totalOnline + stats.totalOffline + stats.totalUnavailable
  const ipProgress = stats.totalServers > 0
    ? Math.round((stats.totalWithIp / stats.totalServers) * 100)
    : 0
  const scanProgress = stats.totalWithIp > 0
    ? Math.round((totalWithStatus / stats.totalWithIp) * 100)
    : 0

  return NextResponse.json({
    queues: {
      pendingIpFetch: stats.pendingIpFetch,
      pendingScan: stats.pendingScan,
      processing: stats.processing
    },
    servers: {
      total: stats.totalServers,
      withIp: stats.totalWithIp,
      online: stats.totalOnline,
      offline: stats.totalOffline,
      unavailable: stats.totalUnavailable,
      ipProgress: `${ipProgress}%`,
      scanProgress: `${scanProgress}%`
    },
    estimate: {
      minutesToCompleteIps: Math.ceil(stats.pendingIpFetch / 7500),
      minutesToCompleteScan: Math.ceil(stats.pendingScan / 12000)
    }
  }, {
    headers: { ...corsHeaders, ...rateLimit.headers }
  })
}
