'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Users, Gamepad2 } from 'lucide-react'
import Link from 'next/link'
import type { FiveMServerSlim } from '@/lib/fivem'

interface Data {
  servers: FiveMServerSlim[]
  totalPlayers: number
  totalServers: number
}

export default function ServersPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.servers
      .filter(s => {
        const name = s.name?.toLowerCase() || ''
        const game = s.gametype?.toLowerCase() || ''
        const tags = s.tags?.toLowerCase() || ''
        return name.includes(q) || game.includes(q) || tags.includes(q)
      })
      .slice(0, limit)
  }, [data, search, limit])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Servers</h1>
        <p className="text-muted mb-8">Loading...</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Servers</h1>
        <p className="text-muted mb-8">Failed to load data</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Servers</h1>
      <p className="text-muted mb-8">
        {data.totalServers.toLocaleString()} servers with {data.totalPlayers.toLocaleString()} players
      </p>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search servers..."
          className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-muted focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      <p className="text-sm text-muted mb-6">
        Showing {filtered.length} of {data.servers.length} servers
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((server, i) => (
          <Link
            key={i}
            href={`/servers/${encodeURIComponent(server.id)}`}
            className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
          >
            <div className="mb-4">
              <h3 className="font-medium truncate group-hover:text-white transition-colors">
                {server.name || server.id}
              </h3>
              {server.gametype && (
                <p className="text-sm text-muted truncate mt-1">{server.gametype}</p>
              )}
            </div>

            <div className="flex items-center gap-4 mb-4 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                <span className="text-white">{server.players.toLocaleString()}</span>/{server.maxPlayers}
              </span>
              {server.mapname && (
                <span className="flex items-center gap-1.5">
                  <Gamepad2 size={14} />
                  <span className="truncate max-w-24">{server.mapname}</span>
                </span>
              )}
            </div>

            <div className="h-1 bg-bg rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  (server.players / server.maxPlayers) * 100 > 90 ? 'bg-red-500' :
                  (server.players / server.maxPlayers) * 100 > 70 ? 'bg-yellow-500' : 'bg-accent'
                }`}
                style={{ width: `${Math.min((server.players / server.maxPlayers) * 100, 100)}%` }}
              />
            </div>
          </Link>
        ))}
      </div>

      {limit < data.servers.length && search === '' && (
        <div className="text-center mt-8">
          <button
            onClick={() => setLimit(l => l + 50)}
            className="px-6 py-2 bg-card border border-border rounded-xl hover:border-zinc-600 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
