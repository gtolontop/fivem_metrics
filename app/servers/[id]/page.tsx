import Link from 'next/link'
import { ArrowLeft, Users, Package, ExternalLink } from 'lucide-react'
import CopyButton from './CopyButton'

function clean(str: string) {
  return str.replace(/\^[0-9]/g, '').replace(/~[a-z]~/gi, '')
}

async function getServer(id: string) {
  const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${id}`, {
    headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
    next: { revalidate: 30 }
  })
  const data = await res.json()
  if (!data.Data) return null

  return {
    id: data.EndPoint || id,
    name: data.Data.hostname || 'Unknown',
    players: data.Data.clients || 0,
    maxPlayers: data.Data.sv_maxclients || 32,
    gametype: data.Data.gametype || '',
    mapname: data.Data.mapname || '',
    resources: data.Data.resources || [],
    vars: data.Data.vars || {},
    icon: data.Data.icon || null,
  }
}

export default async function ServerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const server = await getServer(decodeURIComponent(id))

  if (!server) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <p className="text-muted">Server not found</p>
        <Link href="/servers" className="text-accent hover:underline mt-4 inline-block">Back to servers</Link>
      </div>
    )
  }

  const pct = (server.players / server.maxPlayers) * 100

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/servers" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            {server.icon && (
              <img src={server.icon} alt="" className="w-16 h-16 rounded-xl object-cover bg-bg" />
            )}
            <div>
              <h1 className="text-2xl font-semibold mb-1">{clean(server.name)}</h1>
              {server.gametype && <p className="text-muted">{server.gametype}</p>}
              <p className="text-muted font-mono text-sm mt-2">{server.id}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <CopyButton text={`connect ${server.id}`} />
            <a
              href={`https://cfx.re/join/${server.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2"
            >
              <ExternalLink size={16} /> Join
            </a>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <Users size={16} /> Players
            </span>
            <span><span className="text-white">{server.players}</span> / {server.maxPlayers}</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="Players" value={`${server.players}/${server.maxPlayers}`} />
        <Stat label="Gamemode" value={server.gametype || 'N/A'} />
        <Stat label="Map" value={server.mapname || 'N/A'} />
        <Stat label="Resources" value={server.resources.length} />
      </div>

      {server.vars?.tags && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-sm text-muted mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {String(server.vars.tags).split(',').map(tag => (
              <span key={tag} className="px-3 py-1 bg-bg rounded-lg text-sm">{tag.trim()}</span>
            ))}
          </div>
        </div>
      )}

      {server.resources.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="text-sm text-muted mb-4">Resources ({server.resources.length})</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {server.resources.map(r => (
              <Link
                key={r}
                href={`/resources/${encodeURIComponent(r)}`}
                className="px-3 py-2 bg-bg rounded-lg font-mono text-sm truncate hover:bg-zinc-800 transition-colors"
              >
                {r}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="font-medium truncate">{value}</p>
    </div>
  )
}
