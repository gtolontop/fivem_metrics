import ServerCard from '@/components/ServerCard'
import SearchServers from './SearchServers'

async function getServers() {
  const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
    headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
    cache: 'no-store'
  })
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  const servers: any[] = []
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
        })
      }
    } catch {}
  }
  servers.sort((a, b) => b.players - a.players)
  return servers
}

export default async function ServersPage() {
  const servers = await getServers()
  const totalPlayers = servers.reduce((sum, s) => sum + s.players, 0)

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Servers</h1>
      <p className="text-muted mb-8">
        {servers.length.toLocaleString()} servers online with {totalPlayers.toLocaleString()} players
      </p>

      <SearchServers servers={servers} />
    </div>
  )
}
