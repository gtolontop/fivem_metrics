import { NextResponse } from 'next/server'
import { addScannedServer, getScannedCount, getCache } from '@/lib/cache'

interface ScanResult {
  serverId: string
  resources: string[]
  players: number
}

// POST /api/scan/submit - Bulk submit scanned resources
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const results = body.results as ScanResult[]

    if (!results || !Array.isArray(results)) {
      return NextResponse.json({ error: 'Invalid results' }, { status: 400 })
    }

    let added = 0
    for (const result of results) {
      if (result.resources && result.resources.length > 0) {
        addScannedServer(result.serverId, result.resources, result.players)
        added++
      }
    }

    const cache = getCache()

    return NextResponse.json({
      received: results.length,
      added,
      totalScanned: getScannedCount(),
      totalResources: cache.resources.length
    })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
