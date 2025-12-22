'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Server, Users } from 'lucide-react'

interface ServerInfo {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
}

interface Data {
  name: string
  servers: ServerInfo[]
  serverCount: number
  totalPlayers: number
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

      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <h1 className="text-2xl font-mono font-semibold mb-2">{data.name}</h1>
        <p className="text-muted">FiveM Resource</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Server size={16} />
            <p className="text-sm">Servers</p>
          </div>
          <p className="text-2xl font-semibold">{data.serverCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-2">
            <Users size={16} />
            <p className="text-sm">Players</p>
          </div>
          <p className="text-2xl font-semibold">{data.totalPlayers.toLocaleString()}</p>
        </div>
      </div>

      {data.servers.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-4">Servers using this resource</h2>
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
                <div className="flex items-center gap-2 text-sm text-muted">
                  <Users size={14} />
                  <span className="text-white">{server.players.toLocaleString()}</span>
                  <span>/ {server.maxPlayers}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {data.servers.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">No servers found using this resource in the top 100 servers.</p>
        </div>
      )}
    </div>
  )
}
