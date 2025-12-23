import { NextRequest, NextResponse } from 'next/server'
import { searchResources, getResources, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ resources: [], total: 0 }, { status: 503 })
  }

  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q') || ''
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500)

  // If no query, get total count from all resources
  const [results, allResources] = await Promise.all([
    searchResources(query, limit),
    query ? getResources() : Promise.resolve([]) // Only get total if searching
  ])

  return NextResponse.json({
    resources: results,
    total: query ? allResources.length : results.length,
    query,
    limit
  })
}
