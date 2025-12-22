'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ServerCard from '@/components/ServerCard'

interface Server {
  id: string
  name: string
  players: number
  maxPlayers: number
  gametype?: string
  resources?: string[]
  vars?: Record<string, string>
  icon?: string | null
}

export default function SearchServers({ servers }: { servers: Server[] }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return servers
      .filter(s => {
        const name = s.name?.toLowerCase() || ''
        const game = s.gametype?.toLowerCase() || ''
        const tags = s.vars?.tags?.toLowerCase() || ''
        return name.includes(q) || game.includes(q) || tags.includes(q)
      })
      .slice(0, limit)
  }, [servers, search, limit])

  return (
    <>
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
        Showing {filtered.length} of {servers.length} servers
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((s, i) => <ServerCard key={s.id || i} server={s} />)}
      </div>

      {limit < servers.length && search === '' && (
        <div className="text-center mt-8">
          <button
            onClick={() => setLimit(l => l + 50)}
            className="px-6 py-2 bg-card border border-border rounded-xl hover:border-zinc-600 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </>
  )
}
