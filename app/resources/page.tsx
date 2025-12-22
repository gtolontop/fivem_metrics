'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, Server, Users } from 'lucide-react'
import Link from 'next/link'
import type { FiveMResource } from '@/lib/fivem'

interface Data {
  resources: FiveMResource[]
  totalResources: number
  serversScanned: number
  serversWithIp: number
  totalServers: number
  serversOnline: number
  pendingIpFetch: number
  pendingScan: number
  ipProgress: number
  scanProgress: number
}

export default function ResourcesPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)

  const fetchResources = useCallback(() => {
    fetch('/api/resources')
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetchResources()
  }, [fetchResources])

  // Auto-refresh data while collecting
  useEffect(() => {
    if (!data || (data.ipProgress >= 100 && data.scanProgress >= 100)) return

    const timer = setInterval(() => {
      fetchResources()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(timer)
  }, [data, fetchResources])

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
        <p className="text-muted mb-8">Loading resources...</p>
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
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-4">
        {data?.totalResources.toLocaleString() || 0} unique resources from {data?.serversScanned || 0} / {data?.totalServers || 0} servers
      </p>

      {/* Progress Status */}
      {data && (
        <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
          {/* Phase 1: IP Collection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted">
                IP Collection: {data.serversWithIp.toLocaleString()} / {data.totalServers.toLocaleString()} servers
              </span>
              <span className="text-sm text-white">{data.ipProgress}%</span>
            </div>
            <div className="h-2 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${data.ipProgress}%` }}
              />
            </div>
            {data.pendingIpFetch > 0 && (
              <p className="text-xs text-muted mt-1">{data.pendingIpFetch.toLocaleString()} pending</p>
            )}
          </div>

          {/* Phase 2: Resource Scan */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted">
                Resource Scan: {data.serversScanned.toLocaleString()} / {data.serversWithIp.toLocaleString()} servers with IP
              </span>
              <span className="text-sm text-white">{data.scanProgress}%</span>
            </div>
            <div className="h-2 bg-bg rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-300"
                style={{ width: `${data.scanProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted mt-1">
              {data.serversOnline.toLocaleString()} online
              {data.pendingScan > 0 && ` • ${data.pendingScan.toLocaleString()} pending`}
            </p>
          </div>

          {/* Summary when both complete */}
          {data.ipProgress >= 100 && data.scanProgress >= 100 && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-green-400">
                All {data.totalServers.toLocaleString()} servers processed
              </p>
            </div>
          )}
        </div>
      )}

      {(!data || data.resources.length === 0) ? (
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
