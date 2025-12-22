import { NextResponse } from 'next/server'
import { setIpMapping, getIpMappingCount, forceSaveIpMappings } from '@/lib/cache'
import { isRedisEnabled, setIpMappingsBulk, getIpMappingCount as getRedisIpCount } from '@/lib/redis'

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

    let added = Object.keys(results).length

    // Use Redis if available, otherwise fall back to file storage
    if (isRedisEnabled()) {
      await setIpMappingsBulk(results)
      const total = await getRedisIpCount()
      return NextResponse.json({
        added,
        total,
        workerId: workerId || 'unknown',
        storage: 'redis'
      })
    } else {
      // Fallback to local storage
      for (const [serverId, ip] of Object.entries(results)) {
        if (ip && typeof ip === 'string') {
          setIpMapping(serverId, ip)
        }
      }
      forceSaveIpMappings()

      return NextResponse.json({
        added,
        total: getIpMappingCount(),
        workerId: workerId || 'unknown',
        storage: 'file'
      })
    }
  } catch (error) {
    console.error('Submit error:', error)
    return NextResponse.json({ error: 'Failed to submit' }, { status: 500 })
  }
}
