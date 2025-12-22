import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Package, Server, Filter } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ResourceCard from '../components/ResourceCard'
import { resources, categories, stats } from '../data/mockData'

type SortOption = 'servers' | 'players' | 'name'

export default function Resources() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [sortBy, setSortBy] = useState<SortOption>('servers')

  const filteredResources = useMemo(() => {
    let result = resources.filter(resource => {
      const matchesSearch =
        resource.name.toLowerCase().includes(search.toLowerCase()) ||
        resource.displayName.toLowerCase().includes(search.toLowerCase()) ||
        resource.description?.toLowerCase().includes(search.toLowerCase())

      const matchesCategory =
        category === 'All' || resource.category === category

      return matchesSearch && matchesCategory
    })

    result.sort((a, b) => {
      switch (sortBy) {
        case 'servers':
          return b.serverCount - a.serverCount
        case 'players':
          return b.totalPlayers - a.totalPlayers
        case 'name':
          return a.displayName.localeCompare(b.displayName)
        default:
          return 0
      }
    })

    return result
  }, [search, category, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold text-primary mb-2">Resources</h1>
        <p className="text-secondary">
          Discover the most popular FiveM resources
        </p>
      </motion.div>

      {/* Stats Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex flex-wrap gap-6 mb-8 p-4 glass rounded-xl"
      >
        <div className="flex items-center gap-2">
          <Package size={18} className="text-muted" />
          <span className="text-sm">
            <span className="text-primary font-medium">{stats.totalResources.toLocaleString()}</span>
            <span className="text-muted"> resources tracked</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Server size={18} className="text-muted" />
          <span className="text-sm">
            <span className="text-primary font-medium">{stats.totalServers.toLocaleString()}</span>
            <span className="text-muted"> servers analyzed</span>
          </span>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="space-y-4 mb-8"
      >
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Search resources..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-muted" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input-field w-auto pr-10 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20width%3d%2212%22%20height%3d%2212%22%20viewBox%3d%220%200%2012%2012%22%3e%3cpath%20fill%3d%22%23888%22%20d%3d%22M6%208L1%203h10z%22%2f%3e%3c%2fsvg%3e')] bg-no-repeat bg-[right_1rem_center]"
            >
              <option value="servers">Most Servers</option>
              <option value="players">Most Players</option>
              <option value="name">Name A-Z</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${
                category === cat
                  ? 'bg-white text-background'
                  : 'bg-surface text-secondary hover:text-primary border border-border hover:border-border-light'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Results Count */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="text-sm text-muted mb-6"
      >
        {filteredResources.length} resources found
      </motion.p>

      {/* Resource Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredResources.map((resource, index) => (
          <ResourceCard key={resource.name} resource={resource} index={index} />
        ))}
      </div>

      {filteredResources.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Package size={48} className="mx-auto text-muted mb-4" />
          <p className="text-secondary">No resources found matching your search</p>
        </motion.div>
      )}
    </div>
  )
}
