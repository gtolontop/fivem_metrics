'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Users, ExternalLink, Package, Server, Globe, MessageCircle, Wifi, WifiOff, MapPin, Gamepad2 } from 'lucide-react'
import CopyButton from './CopyButton'

interface ServerFull {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype: string
  mapname: string
  resources: string[]
  vars: Record<string, string>
  server: string
  ip: string | null
  status: 'online' | 'offline' | 'unknown'
}

export default function ServerPage() {
  const params = useParams()
  const id = decodeURIComponent(params.id as string)
  const [server, setServer] = useState<ServerFull | null>(null)
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
  const discord = server.vars?.Discord || server.vars?.discord
  const website = server.vars?.website
  const description = server.vars?.sv_projectDesc
  const locale = server.vars?.locale
  const txAdmin = server.vars?.txAdmin === 'true'
  const onesync = server.vars?.onesync_enabled === 'true'
  const gameBuild = server.vars?.sv_enforceGameBuild

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/servers" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      {/* Header */}
      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold">{server.name}</h1>
              <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                server.status === 'online' ? 'bg-green-500/20 text-green-400' :
                server.status === 'offline' ? 'bg-red-500/20 text-red-400' :
                'bg-zinc-500/20 text-zinc-400'
              }`}>
                {server.status === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
                {server.status}
              </span>
            </div>
            {description && <p className="text-muted mb-3">{description}</p>}
            {server.gametype && <p className="text-sm text-muted">{server.gametype}</p>}
            <p className="text-muted font-mono text-sm mt-2">{server.id}</p>
            {server.ip && <p className="text-muted font-mono text-xs mt-1">IP: {server.ip}</p>}
          </div>

          <div className="flex flex-wrap gap-2">
            {discord && (
              <a
                href={discord.startsWith('http') ? discord : `https://discord.gg/${discord}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#5865F2] text-white font-medium rounded-xl hover:bg-[#4752C4] transition-colors flex items-center gap-2"
              >
                <MessageCircle size={16} /> Discord
              </a>
            )}
            {website && (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-card border border-border font-medium rounded-xl hover:border-zinc-600 transition-colors flex items-center gap-2"
              >
                <Globe size={16} /> Website
              </a>
            )}
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

        {/* Player bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <Users size={16} /> Players
            </span>
            <span><span className="text-white">{server.players.toLocaleString()}</span> / {server.maxPlayers}</span>
          </div>
          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-accent'}`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat icon={<Users size={16} />} label="Players" value={`${server.players.toLocaleString()}/${server.maxPlayers}`} />
        <Stat icon={<Gamepad2 size={16} />} label="Gamemode" value={server.gametype || 'N/A'} />
        <Stat icon={<Package size={16} />} label="Resources" value={server.resources.length} />
        <Stat icon={<MapPin size={16} />} label="Map" value={server.mapname || 'N/A'} />
      </div>

      {/* Server Info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {locale && <Stat label="Locale" value={locale.toUpperCase()} />}
        {gameBuild && <Stat label="Build" value={gameBuild} />}
        {onesync && <Stat label="OneSync" value="Enabled" />}
        {txAdmin && <Stat label="txAdmin" value="Yes" />}
        {server.server && <Stat label="Server" value={server.server} />}
      </div>

      {/* Tags */}
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

      {/* Resources */}
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
