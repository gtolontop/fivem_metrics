import { NextResponse } from 'next/server'
import { syncCountersFromData, rebuildResourceIndex, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

/**
 * Migration endpoint to sync counters and rebuild resource index
 * Call this once after deploying the performance update
 * GET /api/migrate
 */
export async function GET() {
  if (!isQueueEnabled()) {
    return NextResponse.json({
      error: 'Redis not configured'
    }, { status: 503 })
  }

  try {
    console.log('[Migrate] Starting migration...')

    // Sync counters from existing status data
    const counters = await syncCountersFromData()

    // Rebuild resource index
    const resourceCount = await rebuildResourceIndex()

    console.log('[Migrate] Migration complete!')

    return NextResponse.json({
      success: true,
      counters,
      resourcesIndexed: resourceCount
    })
  } catch (error) {
    console.error('[Migrate] Error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
