import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${id}`, {
      headers: { 'User-Agent': 'FiveM-Metrics/1.0' }
    })

    const data = await res.json()
    if (!data.Data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({
      id: data.EndPoint || id,
      name: data.Data.hostname || 'Unknown',
      players: data.Data.clients || 0,
      maxPlayers: data.Data.sv_maxclients || 32,
      gametype: data.Data.gametype || '',
      mapname: data.Data.mapname || '',
      resources: data.Data.resources || [],
      vars: data.Data.vars || {},
      icon: data.Data.icon || null,
    })
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
