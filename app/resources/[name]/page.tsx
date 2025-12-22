import Link from 'next/link'
import { ArrowLeft, Server, Users, ExternalLink } from 'lucide-react'
import ServerCard from '@/components/ServerCard'

async function getData(resourceName: string) {
  const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
    headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
    next: { revalidate: 60 }
  })
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  let serverCount = 0
  let totalPlayers = 0
  const serversWithResource: any[] = []

  for (const line of lines) {
    try {
      const s = JSON.parse(line)
      if (s.Data && s.Data.resources?.includes(resourceName)) {
        serverCount++
        totalPlayers += s.Data.clients || 0
        if (serversWithResource.length < 12) {
          serversWithResource.push({
            id: s.EndPoint,
            name: s.Data.hostname || 'Unknown',
            players: s.Data.clients || 0,
            maxPlayers: s.Data.sv_maxclients || 32,
            gametype: s.Data.gametype || '',
            resources: s.Data.resources || [],
            icon: s.Data.icon || null,
          })
        }
      }
    } catch {}
  }

  serversWithResource.sort((a, b) => b.players - a.players)

  return { serverCount, totalPlayers, servers: serversWithResource }
}

export default async function ResourcePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const resourceName = decodeURIComponent(name)
  const { serverCount, totalPlayers, servers } = await getData(resourceName)

  if (serverCount === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <p className="text-muted">Resource not found</p>
        <Link href="/resources" className="text-accent hover:underline mt-4 inline-block">Back to resources</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/resources" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <h1 className="text-2xl font-semibold font-mono mb-2">{resourceName}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-2"><Server size={20} /></div>
          <p className="text-sm text-muted mb-1">Servers Using</p>
          <p className="text-3xl font-semibold">{serverCount.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-2"><Users size={20} /></div>
          <p className="text-sm text-muted mb-1">Total Players</p>
          <p className="text-3xl font-semibold">{totalPlayers.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-sm text-muted mb-4">Links</h2>
        <div className="flex gap-3">
          <a
            href={`https://github.com/search?q=${encodeURIComponent(resourceName)}&type=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-bg border border-border rounded-xl hover:border-zinc-600 transition-colors flex items-center gap-2"
          >
            <ExternalLink size={16} /> GitHub
          </a>
          <a
            href={`https://forum.cfx.re/search?q=${encodeURIComponent(resourceName)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-bg border border-border rounded-xl hover:border-zinc-600 transition-colors flex items-center gap-2"
          >
            <ExternalLink size={16} /> CFX Forum
          </a>
        </div>
      </div>

      {servers.length > 0 && (
        <>
          <h2 className="text-lg font-medium mb-4">Servers using {resourceName}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((s, i) => <ServerCard key={s.id || i} server={s} />)}
          </div>
        </>
      )}
    </div>
  )
}
