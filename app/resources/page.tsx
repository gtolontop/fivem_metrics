'use client'

import { useState, useEffect, useMemo } from 'react'
import { Search, Server, Users } from 'lucide-react'
import Link from 'next/link'
import type { FiveMResource } from '@/lib/fivem'

interface Data {
  resources: FiveMResource[]
  totalResources: number
  serversScanned: number
}

export default function ResourcesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)

  useEffect(() => {
    fetch('/api/resources')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.resources
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, limit)
  }, [data, search, limit])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Resources</h1>
        <p className="text-muted mb-8">Loading resources from top servers...</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-bg rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-bg rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data || data.resources.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Resources</h1>
        <p className="text-muted mb-8">No resources found</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-8">
        {data.totalResources.toLocaleString()} unique resources from top {data.serversScanned} servers
      </p>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources..."
          className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 text-white placeholder:text-muted focus:outline-none focus:border-zinc-600 transition-colors"
        />
      </div>

      <p className="text-sm text-muted mb-6">
        Showing {filtered.length} of {data.resources.length} resources
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(resource => (
          <Link
            key={resource.name}
            href={`/resources/${encodeURIComponent(resource.name)}`}
            className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
          >
            <h3 className="font-mono font-medium mb-4 truncate group-hover:text-white transition-colors">
              {resource.name}
            </h3>

            <div className="flex items-center gap-6 text-sm text-muted">
              <span className="flex items-center gap-1.5">
                <Server size={14} />
                <span className="text-white">{resource.servers.toLocaleString()}</span> servers
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={14} />
                <span className="text-white">{resource.players.toLocaleString()}</span> players
              </span>
            </div>
          </Link>
        ))}
      </div>

      {limit < data.resources.length && search === '' && (
        <div className="text-center mt-8">
          <button
            onClick={() => setLimit(l => l + 100)}
            className="px-6 py-2 bg-card border border-border rounded-xl hover:border-zinc-600 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  )
}
