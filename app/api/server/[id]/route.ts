import { NextResponse } from 'next/server'
import { getServerDetails } from '@/lib/fivem'
import { getServerIp, getServerStatus, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    // Fetch from FiveM API + our Redis data in parallel
    const [server, ip, status] = await Promise.all([
      getServerDetails(id),
      isQueueEnabled() ? getServerIp(id) : null,
      isQueueEnabled() ? getServerStatus(id) : 'unknown'
    ])

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...server,
      ip: ip || null,
      status: status || 'unknown'
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to fetch server' }, { status: 500 })
  }
}
