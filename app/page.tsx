'use client'

import { useState, useEffect } from 'react'
import { Server, Users } from 'lucide-react'
import Link from 'next/link'
import type { FiveMServerSlim, FiveMResource } from '@/lib/fivem'

interface Data {
  servers: FiveMServerSlim[]
  resources: FiveMResource[]
  totalPlayers: number
  totalServers: number
}

export default function Home() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
          <p className="text-muted text-lg">Loading...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
          <p className="text-muted text-lg">Failed to load data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
        <p className="text-muted text-lg">Real-time tracking of FiveM servers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-16">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-3"><Server size={20} /></div>
          <p className="text-sm text-muted mb-1">Servers</p>
          <p className="text-3xl font-semibold">{data.totalServers.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-3"><Users size={20} /></div>
          <p className="text-sm text-muted mb-1">Players Online</p>
          <p className="text-3xl font-semibold">{data.totalPlayers.toLocaleString()}</p>
        </div>
      </div>

      <section className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Servers</h2>
          <Link href="/servers" className="text-sm text-muted hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.servers.slice(0, 6).map((server, i) => (
            <Link
              key={i}
              href={`/servers/${encodeURIComponent(server.id)}`}
              className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
            >
              <h3 className="font-medium truncate mb-2 group-hover:text-white transition-colors">
                {server.name}
              </h3>
              {server.gametype && (
                <p className="text-sm text-muted truncate">{server.gametype}</p>
              )}
              <div className="flex items-center gap-2 mt-3 text-sm">
                <Users size={14} className="text-muted" />
                <span className="text-white">{server.players.toLocaleString()}</span>
                <span className="text-muted">/ {server.maxPlayers}</span>
              </div>
              <div className="h-1 bg-bg rounded-full overflow-hidden mt-3">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.min((server.players / server.maxPlayers) * 100, 100)}%` }}
                />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
