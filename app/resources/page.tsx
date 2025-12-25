'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Server, Users, Loader2 } from 'lucide-react'
import Link from 'next/link'
import type { FiveMResource } from '@/lib/fivem'

interface ApiResponse {
  resources: FiveMResource[]
  total: number
  hasMore: boolean
}

export default function ResourcesPage() {
  const [resources, setResources] = useState<FiveMResource[]>([])
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

  // Initial load or search change - DIRECT FETCH, no SSE
  useEffect(() => {
    setLoading(true)
    setResources([])

    const query = debouncedSearch ? `q=${encodeURIComponent(debouncedSearch)}&` : ''
    fetch(`/api/resources/search?${query}limit=50&offset=0`)
      .then(res => res.json())
      .then((data: ApiResponse) => {
        setResources(data.resources)
        setTotal(data.total)
        setHasMore(data.hasMore)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch])

  // Load more function
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return

    setLoadingMore(true)
    const offset = resources.length
    const query = debouncedSearch ? `q=${encodeURIComponent(debouncedSearch)}&` : ''

    try {
      const res = await fetch(`/api/resources/search?${query}limit=50&offset=${offset}`)
      const data: ApiResponse = await res.json()

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

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-6">
        {total > 0 ? `${total.toLocaleString()} unique resources` : 'Loading...'}
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search resources..."
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
      {loading && resources.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
              <div className="h-5 bg-bg rounded w-2/3 mb-4"></div>
              <div className="h-4 bg-bg rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">
            {debouncedSearch ? 'No resources found.' : 'No resources available.'}
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
