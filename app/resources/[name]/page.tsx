'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Server, Users, Package, TrendingUp } from 'lucide-react'

interface ServerInfo {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
}

interface RelatedResource {
  name: string
  servers: number
  players: number
}

interface Data {
  name: string
  servers: ServerInfo[]
  serverCount: number
  onlineServers: number
  totalPlayers: number
  prefix: string | null
  relatedResources: RelatedResource[]
  scanProgress: number
}

export default function ResourcePage() {
  const params = useParams()
  const name = decodeURIComponent(params.name as string)
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/resource/${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [name])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link href="/resources" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 animate-pulse">
          <div className="h-8 bg-bg rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-bg rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (!data) {
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

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-mono font-semibold mb-2">{data.name}</h1>
            <p className="text-muted">FiveM Resource</p>
            {data.prefix && (
              <p className="text-sm text-muted mt-2">
                Creator prefix: <span className="text-white font-mono">{data.prefix}</span>
              </p>
            )}
          </div>
          {data.scanProgress < 100 && (
            <div className="text-right">
              <p className="text-xs text-muted">Scan progress</p>
              <p className="text-lg font-semibold">{data.scanProgress}%</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Server size={16} />
            <p className="text-sm">Total Servers</p>
          </div>
          <p className="text-2xl font-semibold">{data.serverCount.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <TrendingUp size={16} />
            <p className="text-sm">Online Now</p>
          </div>
          <p className="text-2xl font-semibold text-green-400">{data.onlineServers.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Users size={16} />
            <p className="text-sm">Total Players</p>
          </div>
          <p className="text-2xl font-semibold">{data.totalPlayers.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Package size={16} />
            <p className="text-sm">Avg Players/Server</p>
          </div>
          <p className="text-2xl font-semibold">
            {data.onlineServers > 0 ? Math.round(data.totalPlayers / data.onlineServers) : 0}
          </p>
        </div>
      </div>

      {/* Related Resources */}
      {data.relatedResources.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8">
          <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
            <Package size={18} />
            Related by creator
            <span className="text-muted font-mono text-sm">({data.prefix})</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.relatedResources.map(r => (
              <Link
                key={r.name}
                href={`/resources/${encodeURIComponent(r.name)}`}
                className="bg-bg rounded-xl p-4 hover:bg-zinc-800 transition-colors group"
              >
                <p className="font-mono text-sm truncate group-hover:text-white transition-colors mb-2">
                  {r.name}
                </p>
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span className="flex items-center gap-1">
                    <Server size={12} />
                    {r.servers.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {r.players.toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Servers List */}
      {data.servers.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Servers using this resource ({data.servers.length} online)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.servers.map(server => (
              <Link
                key={server.id}
                href={`/servers/${encodeURIComponent(server.id)}`}
                className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
              >
                <h3 className="font-medium truncate mb-2 group-hover:text-white transition-colors">
                  {server.name}
                </h3>
                {server.gametype && (
                  <p className="text-sm text-muted truncate mb-3">{server.gametype}</p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <Users size={14} />
                    <span className="text-white">{server.players.toLocaleString()}</span>
                    <span>/ {server.maxPlayers}</span>
                  </div>
                  <div className="h-1.5 w-16 bg-bg rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full"
                      style={{ width: `${Math.min((server.players / server.maxPlayers) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.servers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">
            {data.serverCount > 0
              ? `${data.serverCount} servers have this resource, but none are currently online.`
              : 'No servers found using this resource yet.'}
          </p>
        </div>
      )}
    </div>
  )
}
