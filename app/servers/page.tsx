'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Users, Gamepad2, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { FiveMServerSlim } from '@/lib/fivem'

interface ApiResponse {
  servers: FiveMServerSlim[]
  total: number
  totalPlayers: number
  totalServers: number
  serversOnline: number
  hasMore: boolean
}

export default function ServersPage() {
  const [servers, setServers] = useState<FiveMServerSlim[]>([])
  const [stats, setStats] = useState({ totalPlayers: 0, totalServers: 0, serversOnline: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
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

  // Initial load or search change
  useEffect(() => {
    setLoading(true)
    setServers([])

    const query = debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ''
    fetch(`/api/servers?limit=50&offset=0${query}`)
      .then(res => res.json())
      .then((data: ApiResponse) => {
        setServers(data.servers)
        setTotal(data.total)
        setHasMore(data.hasMore)
        setStats({
          totalPlayers: data.totalPlayers,
          totalServers: data.totalServers,
          serversOnline: data.serversOnline
        })
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const offset = servers.length
    const query = debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : ''

    try {
      const res = await fetch(`/api/servers?limit=50&offset=${offset}${query}`)
      const data: ApiResponse = await res.json()

      setServers(prev => [...prev, ...data.servers])
      setHasMore(data.hasMore)
    } finally {
      setLoadingMore(false)
    }
  }, [servers.length, debouncedSearch, loadingMore, hasMore])

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

  if (loading && servers.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-semibold mb-2">Servers</h1>
        <p className="text-muted mb-8">Loading...</p>
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
      <h1 className="text-3xl font-semibold mb-2">Servers</h1>
      <p className="text-muted mb-8">
        {stats.totalServers.toLocaleString()} servers with {stats.totalPlayers.toLocaleString()} players
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${stats.totalServers.toLocaleString()} servers...`}
          className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-12 text-white placeholder:text-muted focus:outline-none focus:border-zinc-600 transition-colors"
        />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-muted animate-spin" size={18} />}
      </div>

      {/* Results info */}
      <p className="text-sm text-muted mb-6">
        {debouncedSearch
          ? `Found ${total.toLocaleString()} servers matching "${debouncedSearch}"`
          : `Showing ${servers.length} of ${total.toLocaleString()} servers`}
      </p>

      {/* Grid */}
      {servers.length === 0 && !loading ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">
            {debouncedSearch ? 'No servers found.' : 'No servers available.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.map((server, i) => (
              <Link
                key={`${server.id}-${i}`}
                href={`/servers/${encodeURIComponent(server.id)}`}
                className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
              >
                <div className="mb-4">
                  <h3 className="font-medium truncate group-hover:text-white transition-colors">
                    {server.name || server.id}
                  </h3>
                  {server.gametype && (
                    <p className="text-sm text-muted truncate mt-1">{server.gametype}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Users size={14} />
                    <span className="text-white">{server.players.toLocaleString()}</span>/{server.maxPlayers}
                  </span>
                  {server.mapname && (
                    <span className="flex items-center gap-1.5">
                      <Gamepad2 size={14} />
                      <span className="truncate max-w-24">{server.mapname}</span>
                    </span>
                  )}
                </div>

                <div className="h-1 bg-bg rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      (server.players / server.maxPlayers) * 100 > 90 ? 'bg-red-500' :
                      (server.players / server.maxPlayers) * 100 > 70 ? 'bg-yellow-500' : 'bg-accent'
                    }`}
                    style={{ width: `${Math.min((server.players / server.maxPlayers) * 100, 100)}%` }}
                  />
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
            {!hasMore && servers.length > 0 && (
              <p className="text-muted text-sm">All {total.toLocaleString()} servers loaded</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
