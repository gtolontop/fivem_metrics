import { NextResponse } from 'next/server'
import { setIpMapping, getIpMappingCount, forceSaveIpMappings } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Workers POST their results here
export async function POST(request: Request) {
  try {
    const { results, workerId } = await request.json() as {
      results: Record<string, string>
      workerId?: string
    }

    if (!results || typeof results !== 'object') {
      return NextResponse.json({ error: 'results object required' }, { status: 400 })
    }

    let added = 0
    for (const [serverId, ip] of Object.entries(results)) {
      if (ip && typeof ip === 'string') {
        setIpMapping(serverId, ip)
        added++
      }
    }

    // Force save to disk
    forceSaveIpMappings()

    return NextResponse.json({
      added,
      total: getIpMappingCount(),
      workerId: workerId || 'unknown'
    })
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}
