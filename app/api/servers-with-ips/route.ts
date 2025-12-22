import { NextResponse } from 'next/server'
import { getServersWithIp } from '@/lib/cache'

// GET /api/servers-with-ips - Returns all servers that have IPs cached
export async function GET() {
  const serversWithIp = getServersWithIp()

  // Format for ultra-scan: { id, ip, players }
  const result = serversWithIp.map(({ server, ip }) => ({
    id: server.id,
    ip,
    players: server.players
  }))

  return NextResponse.json(result)
}
