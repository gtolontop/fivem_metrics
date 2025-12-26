import { NextResponse } from 'next/server'
import { getServerDetails } from '@/lib/fivem'
import { getServerIp, getServerStatus, isQueueEnabled } from '@/lib/queue'
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

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimit = applyRateLimit(request, RATE_LIMITS.api)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  const { id } = await params

  try {
    // Fetch from FiveM API + our Redis data in parallel
    const [server, ip, status] = await Promise.all([
      getServerDetails(id),
      isQueueEnabled() ? getServerIp(id) : null,
      isQueueEnabled() ? getServerStatus(id) : 'unknown'
    ])

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, {
        status: 404,
        headers: { ...corsHeaders, ...rateLimit.headers }
      })
    }

    return NextResponse.json({
      ...server,
      ip: ip || null,
      status: status || 'unknown'
    }, {
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to fetch server' }, {
      status: 500,
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }
}
