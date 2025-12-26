import { getHomepageSnapshot, isQueueEnabled } from '@/lib/queue'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * INSTANT homepage data endpoint
 * Returns pre-computed snapshot in a single GET - no SSE needed for initial load!
 * All calculations are done by the background worker, this just returns cached JSON.
 */
export async function GET() {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  try {
    const snapshot = await getHomepageSnapshot()

    if (!snapshot) {
      // No snapshot yet - worker hasn't run aggregation
      return NextResponse.json({
        resources: [],
        totalResources: 0,
        totalServers: 0,
        serversOnline: 0,
        serversScanned: 0,
        serversWithIp: 0,
        totalPlayers: 0,
        pendingIpFetch: 0,
        pendingScan: 0,
        ipProgress: 0,
        scanProgress: 0,
        timestamp: Date.now()
      })
    }

    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=1, stale-while-revalidate=5'
      }
    })
  } catch (error) {
    console.error('[Snapshot] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
