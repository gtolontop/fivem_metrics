import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Worker endpoint - fetch IPs for a batch of server IDs
// Each worker instance has different IP = no central rate limit!

const BATCH_SIZE = 50 // Each worker processes 50 servers at a time

export async function POST(request: Request) {
  try {
    const { serverIds } = await request.json() as { serverIds: string[] }

    if (!serverIds || !Array.isArray(serverIds)) {
      return NextResponse.json({ error: 'serverIds required' }, { status: 400 })
    }

    const results: Record<string, string> = {}
    let successCount = 0

    // Fetch IPs in parallel - each server is independent
    const promises = serverIds.slice(0, BATCH_SIZE).map(async (serverId) => {
      try {
        const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })

        if (res.ok) {
          const data = await res.json()
          const endpoints = data.Data?.connectEndPoints
          if (endpoints && endpoints.length > 0) {
            results[serverId] = endpoints[0]
            successCount++
          }
        }
      } catch {
        // Skip failed servers
      }
    })

    await Promise.all(promises)

    return NextResponse.json({
      success: successCount,
      total: serverIds.length,
      results
    })
  } catch (error) {
    console.error('Worker error:', error)
    return NextResponse.json({ error: 'Worker failed' }, { status: 500 })
  }
}
