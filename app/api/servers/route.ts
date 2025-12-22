import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
      headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
      cache: 'no-store'
    })

    const text = await res.text()
    const lines = text.split('\n').filter(l => l.trim())

    const servers = []
    for (const line of lines) {
      try {
        const s = JSON.parse(line)
        if (s.Data) {
          servers.push({
            id: s.EndPoint,
            name: s.Data.hostname || 'Unknown',
            players: s.Data.clients || 0,
            maxPlayers: s.Data.sv_maxclients || 32,
            gametype: s.Data.gametype || '',
            resources: s.Data.resources || [],
            vars: s.Data.vars || {},
            icon: s.Data.icon || null,
            upvotePower: s.Data.upvotePower || 0,
          })
        }
      } catch {}
    }

    servers.sort((a, b) => b.players - a.players)
    return NextResponse.json(servers)
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
