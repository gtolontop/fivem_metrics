import { NextResponse } from 'next/server'
import { getServerDetails } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const server = await getServerDetails(id)

    if (!server) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 })
    }

    return NextResponse.json(server)
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Failed to fetch server' }, { status: 500 })
  }
}
