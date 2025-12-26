import { NextRequest, NextResponse } from 'next/server'
import { searchResources, isQueueEnabled } from '@/lib/queue'
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
  const rateLimit = applyRateLimit(request, RATE_LIMITS.search)
  if (!rateLimit.allowed) {
    return rateLimit.response
  }

  if (!isQueueEnabled()) {
    return NextResponse.json({ resources: [], total: 0 }, {
      status: 503,
      headers: { ...corsHeaders, ...rateLimit.headers }
    })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const { resources, total } = await searchResources(query, limit, offset)

  return NextResponse.json({
    resources,
    total,
    query,
    limit,
    offset,
    hasMore: offset + resources.length < total
  }, {
    headers: { ...corsHeaders, ...rateLimit.headers }
  })
}
