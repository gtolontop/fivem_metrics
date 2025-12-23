'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Server, Users, Wifi, WifiOff, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRealtimeStats } from '@/lib/useRealtimeStats'
import { AnimatedCounter, AnimatedProgress } from '@/components/AnimatedCounter'
import type { FiveMResource } from '@/lib/fivem'

export default function ResourcesPage() {
  const { data, connected } = useRealtimeStats()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [resources, setResources] = useState<FiveMResource[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const loaderRef = useRef<HTMLDivElement>(null)

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search.trim())
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  // Initial load or search
  useEffect(() => {
    if (debouncedSearch) {
      // Search mode - fetch from API
      setLoading(true)
      setResources([])

      fetch(`/api/resources/search?q=${encodeURIComponent(debouncedSearch)}&limit=50&offset=0`)
        .then(res => res.json())
        .then(data => {
          setResources(data.resources)
          setTotal(data.total)
          setHasMore(data.hasMore)
        })
        .finally(() => setLoading(false))
    } else if (data?.resources) {
      // No search - use SSE data (top 100)
      setResources(data.resources)
      setTotal(data.totalResources)
      setHasMore(data.resources.length < data.totalResources)
    }
  }, [debouncedSearch, data?.resources, data?.totalResources])

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const offset = resources.length
    const query = debouncedSearch ? `q=${encodeURIComponent(debouncedSearch)}&` : ''

    try {
      const res = await fetch(`/api/resources/search?${query}limit=50&offset=${offset}`)
      const data = await res.json()

      setResources(prev => [...prev, ...data.resources])
      setHasMore(data.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [resources.length, debouncedSearch, loadingMore, hasMore])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loader)
    return () => observer.disconnect()
  }, [loadMore, hasMore, loadingMore, loading])

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Resources</h1>
        <p className="text-muted mb-8">Connecting...</p>
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
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-semibold">Resources</h1>
        <div className={`flex items-center gap-2 text-sm ${connected ? 'text-green-400' : 'text-yellow-400'}`}>
          {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
          {connected ? 'Live' : 'Reconnecting...'}
        </div>
      </div>

      <p className="text-muted mb-4">
        <AnimatedCounter value={data.totalResources} className="text-white" /> unique resources from{' '}
        <AnimatedCounter value={data.serversOnline} className="text-white" /> online servers
      </p>

      {/* Progress */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted">
              IP Collection: <AnimatedCounter value={data.serversWithIp} className="text-white" /> / <AnimatedCounter value={data.totalServers} className="text-white" />
            </span>
            <span className="text-white"><AnimatedCounter value={data.ipProgress} />%</span>
          </div>
          <AnimatedProgress value={data.ipProgress} barClassName="h-full bg-blue-500" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-muted">
              Scan: <AnimatedCounter value={data.serversScanned} className="text-white" /> scanned
            </span>
            <span className="text-white"><AnimatedCounter value={data.scanProgress} />%</span>
          </div>
          <AnimatedProgress value={data.scanProgress} barClassName="h-full bg-accent" />
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${total.toLocaleString()} resources...`}
          className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-12 text-white placeholder:text-muted focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted animate-spin" size={18} />}
      </div>

      {/* Results info */}
      <p className="text-sm text-muted mb-6">
        {debouncedSearch
          ? `Found ${total.toLocaleString()} resources matching "${debouncedSearch}"`
          : `Showing ${resources.length} of ${total.toLocaleString()} resources`}
      </p>

      {/* Grid */}
      {resources.length === 0 && !loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">
            {debouncedSearch ? 'No resources found.' : 'Loading...'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {resources.map(resource => (
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

          {/* Infinite scroll loader */}
          <div ref={loaderRef} className="py-8 text-center">
            {loadingMore && (
              <div className="flex items-center justify-center gap-2 text-muted">
                <Loader2 className="animate-spin" size={20} />
                Loading more...
              </div>
            )}
            {!hasMore && resources.length > 0 && (
              <p className="text-muted text-sm">All {total.toLocaleString()} resources loaded</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
