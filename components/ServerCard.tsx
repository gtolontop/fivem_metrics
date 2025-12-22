'use client'

import Link from 'next/link'
import { Users, Package } from 'lucide-react'
import type { FiveMServer } from '@/lib/fivem'

function clean(str: string) {
  return str.replace(/\^[0-9]/g, '').replace(/~[a-z]~/gi, '')
}

export default function ServerCard({ server }: { server: FiveMServer }) {
  const pct = (server.players / server.maxPlayers) * 100

  return (
    <Link
      href={`/servers/${encodeURIComponent(server.id)}`}
      className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
    >
      <div className="flex items-start gap-3 mb-4">
        {server.icon && (
          <img
            src={server.icon}
            alt=""
            className="w-10 h-10 rounded-lg object-cover bg-bg flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-medium truncate group-hover:text-white transition-colors">
            {clean(server.name)}
          </h3>
          {server.gametype && (
            <p className="text-sm text-muted truncate">{server.gametype}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          <span className="text-white">{server.players}</span>/{server.maxPlayers}
        </span>
        <span className="flex items-center gap-1.5">
          <Package size={14} />
          {server.resources?.length || 0}
        </span>
      </div>

      <div className="h-1 bg-bg rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-accent'}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </Link>
  )
}
