import { Server, Users, Package } from 'lucide-react'
import Link from 'next/link'
import ServerCard from '@/components/ServerCard'
import ResourceCard from '@/components/ResourceCard'

async function getData() {
  const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
    headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
    cache: 'no-store'
  })
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  const servers: any[] = []
  const resourceMap = new Map<string, { name: string; servers: number; players: number }>()

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

        for (const r of s.Data.resources || []) {
          if (!r || r.length < 2) continue
          const existing = resourceMap.get(r) || { name: r, servers: 0, players: 0 }
          existing.servers++
          existing.players += s.Data.clients || 0
          resourceMap.set(r, existing)
        }
      }
    } catch {}
  }

  servers.sort((a, b) => b.players - a.players)
  const resources = Array.from(resourceMap.values()).sort((a, b) => b.servers - a.servers)
  const totalPlayers = servers.reduce((sum, s) => sum + s.players, 0)

  return { servers, resources, totalPlayers, totalServers: servers.length, totalResources: resources.length }
}

export default async function Home() {
  const { servers, resources, totalPlayers, totalServers, totalResources } = await getData()

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
        <p className="text-muted text-lg">Real-time tracking of servers and resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        <Stat icon={<Server size={20} />} label="Servers" value={totalServers} />
        <Stat icon={<Users size={20} />} label="Players Online" value={totalPlayers} />
        <Stat icon={<Package size={20} />} label="Resources" value={totalResources} />
      </div>

      <section className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Servers</h2>
          <Link href="/servers" className="text-sm text-muted hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.slice(0, 6).map((s, i) => <ServerCard key={s.id || i} server={s} />)}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Resources</h2>
          <Link href="/resources" className="text-sm text-muted hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.slice(0, 6).map((r, i) => <ResourceCard key={r.name} resource={r} />)}
        </div>
      </section>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="text-muted mb-3">{icon}</div>
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-3xl font-semibold">{value.toLocaleString()}</p>
    </div>
  )
}
