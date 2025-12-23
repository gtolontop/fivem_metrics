'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Server, Users, Wifi, WifiOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRealtimeStats } from '@/lib/useRealtimeStats'
import { AnimatedCounter, AnimatedProgress } from '@/components/AnimatedCounter'
import type { FiveMResource } from '@/lib/fivem'

export default function ResourcesPage() {
  const { data, connected } = useRealtimeStats()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<FiveMResource[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [displayLimit, setDisplayLimit] = useState(100)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!search.trim()) {
      setDebouncedSearch('')
      setSearchResults(null)
      return
    }

    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [search])

  // Fetch search results from API
  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults(null)
      return
    }

    const controller = new AbortController()
    setSearching(true)

    fetch(`/api/resources/search?q=${encodeURIComponent(debouncedSearch)}&limit=200`, {
      signal: controller.signal
    })
      .then(res => res.json())
      .then(data => {
        setSearchResults(data.resources)
        setSearching(false)
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Search error:', err)
          setSearching(false)
        }
      })

    return () => controller.abort()
  }, [debouncedSearch])

  // Resources to display: search results or SSE data
  const displayResources = debouncedSearch ? searchResults : data?.resources.slice(0, displayLimit)
  const totalResources = data?.totalResources ?? 0

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
        <AnimatedCounter value={totalResources} className="text-white" /> unique resources from <AnimatedCounter value={data.serversOnline} className="text-white" /> online servers
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

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${totalResources.toLocaleString()} resources...`}
          className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-12 text-white placeholder:text-muted focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {searching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted animate-spin" size={18} />
        )}
      </div>

      {/* Results info */}
      <p className="text-sm text-muted mb-6">
        {debouncedSearch ? (
          searching ? (
            'Searching...'
          ) : (
            <>Found {searchResults?.length ?? 0} resources matching "{debouncedSearch}"</>
          )
        ) : (
          <>Showing top {displayResources?.length ?? 0} of {totalResources.toLocaleString()} resources</>
        )}
      </p>

      {/* Resource Grid */}
      {!displayResources || displayResources.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">
            {debouncedSearch ? 'No resources found matching your search.' : 'No resources found yet. Scanning in progress...'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayResources.map(resource => (
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
                      <span className="text-green-400">({resource.onlineServers.toLocaleString()} online)</span>
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

          {/* Load More - only when not searching */}
          {!debouncedSearch && displayLimit < totalResources && (
            <div className="text-center mt-8">
              <button
                onClick={() => setDisplayLimit(l => l + 100)}
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
