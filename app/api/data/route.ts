import { NextResponse } from 'next/server'
import { getServersDirect } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await getServersDirect()
    return NextResponse.json(data)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ servers: [], resources: [], totalPlayers: 0, totalServers: 0 })
  }
}
