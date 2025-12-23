'use client'

import { useState, useMemo } from 'react'
import { Search, Server, Users, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useRealtimeStats } from '@/lib/useRealtimeStats'
import { AnimatedCounter, AnimatedProgress } from '@/components/AnimatedCounter'

export default function ResourcesPage() {
  const { data, connected } = useRealtimeStats()
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.toLowerCase()
    return data.resources
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, limit)
  }, [data, search, limit])

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Resources</h1>
        <p className="text-muted mb-8">Connecting to real-time stream...</p>
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

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold">Resources</h1>
        <div className={`flex items-center gap-2 text-sm ${connected ? 'text-green-400' : 'text-yellow-400'}`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          <span>{connected ? 'Live' : 'Reconnecting...'}</span>
        </div>
      </div>
      <p className="text-muted mb-4">
        <AnimatedCounter value={data.totalResources} className="text-white" /> unique resources from <AnimatedCounter value={data.serversOnline} className="text-white" /> online servers
      </p>

      {/* Progress Status */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
        {/* Phase 1: IP Collection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">
              IP Collection: <AnimatedCounter value={data.serversWithIp} className="text-white" /> / <AnimatedCounter value={data.totalServers} className="text-white" /> servers
            </span>
            <span className="text-sm text-white"><AnimatedCounter value={data.ipProgress} />%</span>
          </div>
          <AnimatedProgress value={data.ipProgress} barClassName="h-full bg-blue-500" />
          {data.pendingIpFetch > 0 && (
            <p className="text-xs text-muted mt-1"><AnimatedCounter value={data.pendingIpFetch} /> pending</p>
          )}
        </div>

        {/* Phase 2: Resource Scan */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted">
              Resource Scan: <AnimatedCounter value={data.serversScanned} className="text-white" /> scanned
            </span>
            <span className="text-sm text-white"><AnimatedCounter value={data.scanProgress} />%</span>
          </div>
          <AnimatedProgress value={data.scanProgress} barClassName="h-full bg-accent" />
          <p className="text-xs text-muted mt-1">
            <AnimatedCounter value={data.serversOnline} className="text-green-400" /> online
            {data.pendingScan > 0 && <> • <AnimatedCounter value={data.pendingScan} /> pending</>}
          </p>
        </div>

        {/* Summary when both complete */}
        {data.ipProgress >= 100 && data.scanProgress >= 100 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-green-400">
              All <AnimatedCounter value={data.totalServers} /> servers processed
            </p>
          </div>
        )}
      </div>

      {data.resources.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">No resources found yet. Scanning in progress...</p>
        </div>
      ) : (
        <>
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
                    {resource.onlineServers !== undefined && resource.onlineServers !== resource.servers && (
                      <span className="text-green-400">({resource.onlineServers} online)</span>
                    )}
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
        </>
      )}
    </div>
  )
}
