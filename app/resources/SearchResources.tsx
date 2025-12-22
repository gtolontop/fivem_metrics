'use client'

import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import ResourceCard from '@/components/ResourceCard'

interface Resource {
  name: string
  servers: number
  players: number
}

export default function SearchResources({ resources }: { resources: Resource[] }) {
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(100)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return resources
      .filter(r => r.name.toLowerCase().includes(q))
      .slice(0, limit)
  }, [resources, search, limit])

  return (
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
        Showing {filtered.length} of {resources.length} resources
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(r => <ResourceCard key={r.name} resource={r} />)}
      </div>

      {limit < resources.length && search === '' && (
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
  )
}
