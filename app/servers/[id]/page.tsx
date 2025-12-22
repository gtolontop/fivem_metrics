'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Users, ExternalLink, Package, Server } from 'lucide-react'
import CopyButton from './CopyButton'
import type { FiveMServerFull } from '@/lib/fivem'

export default function ServerPage() {
  const params = useParams()
  const id = decodeURIComponent(params.id as string)
  const [server, setServer] = useState<FiveMServerFull | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/server/${encodeURIComponent(id)}`)
      .then(res => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then(setServer)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <Link href="/servers" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
          <ArrowLeft size={18} /> Back
        </Link>
        <div className="bg-card border border-border rounded-xl p-8 animate-pulse">
          <div className="h-8 bg-bg rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-bg rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (notFound || !server) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <p className="text-muted">Server not found</p>
        <Link href="/servers" className="text-accent hover:underline mt-4 inline-block">Back to servers</Link>
      </div>
    )
  }

  const pct = server.maxPlayers > 0 ? (server.players / server.maxPlayers) * 100 : 0

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/servers" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-semibold mb-1">{server.name}</h1>
            {server.gametype && <p className="text-muted">{server.gametype}</p>}
            <p className="text-muted font-mono text-sm mt-2">{server.id}</p>
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
            <span><span className="text-white">{server.players.toLocaleString()}</span> / {server.maxPlayers}</span>
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
        <Stat icon={<Users size={16} />} label="Players" value={`${server.players.toLocaleString()}/${server.maxPlayers}`} />
        <Stat icon={<Server size={16} />} label="Gamemode" value={server.gametype || 'N/A'} />
        <Stat icon={<Package size={16} />} label="Resources" value={server.resources.length} />
        <Stat label="Map" value={server.mapname || 'N/A'} />
      </div>

      {server.vars?.tags && (
        <div className="bg-card border border-border rounded-xl p-6 mb-6">
          <h2 className="text-sm text-muted mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {String(server.vars.tags).split(',').filter(t => t.trim()).slice(0, 20).map(tag => (
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

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted mb-1">
        {icon}
        <p className="text-xs">{label}</p>
      </div>
      <p className="font-medium truncate">{value}</p>
    </div>
  )
}
