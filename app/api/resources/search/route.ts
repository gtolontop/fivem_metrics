import { NextRequest, NextResponse } from 'next/server'
import { searchResources, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ resources: [], total: 0 }, { status: 503 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  const { resources, total } = await searchResources(query, limit, offset)

  return NextResponse.json({
    resources,
    total,
    query,
    limit,
    offset,
    hasMore: offset + resources.length < total
  })
}
