import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Server, Users, Filter } from 'lucide-react'
import SearchBar from '../components/SearchBar'
import ServerCard from '../components/ServerCard'
import { servers, stats } from '../data/mockData'

type SortOption = 'players' | 'name' | 'ping'

export default function Servers() {
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('players')

  const filteredServers = useMemo(() => {
    let result = servers.filter(server =>
      server.name.toLowerCase().includes(search.toLowerCase()) ||
      server.ip.includes(search) ||
      server.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))
    )

    result.sort((a, b) => {
      switch (sortBy) {
        case 'players':
          return b.players - a.players
        case 'name':
          return a.name.localeCompare(b.name)
        case 'ping':
          return a.ping - b.ping
        default:
          return 0
      }
    })

    return result
  }, [search, sortBy])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-semibold text-primary mb-2">Servers</h1>
        <p className="text-secondary">
          Browse and discover FiveM servers
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
          <Server size={18} className="text-muted" />
          <span className="text-sm">
            <span className="text-primary font-medium">{stats.serversOnline.toLocaleString()}</span>
            <span className="text-muted"> servers online</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Users size={18} className="text-muted" />
          <span className="text-sm">
            <span className="text-primary font-medium">{stats.totalPlayers.toLocaleString()}</span>
            <span className="text-muted"> players</span>
          </span>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="flex flex-col md:flex-row gap-4 mb-8"
      >
        <div className="flex-1">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search servers by name, IP, or tags..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-muted" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="input-field w-auto pr-10 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg%20xmlns%3d%22http%3a%2f%2fwww.w3.org%2f2000%2fsvg%22%20width%3d%2212%22%20height%3d%2212%22%20viewBox%3d%220%200%2012%2012%22%3e%3cpath%20fill%3d%22%23888%22%20d%3d%22M6%208L1%203h10z%22%2f%3e%3c%2fsvg%3e')] bg-no-repeat bg-[right_1rem_center]"
          >
            <option value="players">Most Players</option>
            <option value="name">Name A-Z</option>
            <option value="ping">Lowest Ping</option>
          </select>
        </div>
      </motion.div>

      {/* Results Count */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="text-sm text-muted mb-6"
      >
        {filteredServers.length} servers found
      </motion.p>

      {/* Server Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredServers.map((server, index) => (
          <ServerCard key={server.id} server={server} index={index} />
        ))}
      </div>

      {filteredServers.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Server size={48} className="mx-auto text-muted mb-4" />
          <p className="text-secondary">No servers found matching your search</p>
        </motion.div>
      )}
    </div>
  )
}
