import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Server, Users, Package, Activity, TrendingUp, Zap, Loader2 } from 'lucide-react'
import StatCard from '../components/StatCard'
import ServerCard from '../components/ServerCard'
import ResourceCard from '../components/ResourceCard'
import { useServers } from '../hooks/useServers'
import { useResources } from '../hooks/useResources'
import { useStats } from '../hooks/useStats'

export default function Home() {
  const { servers, loading: loadingServers } = useServers()
  const { resources, loading: loadingResources } = useResources()
  const { stats, loading: loadingStats } = useStats()

  const topServers = servers.slice(0, 6)
  const topResources = resources.slice(0, 6)

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-primary mb-4 tracking-tight">
          FiveM Metrics
        </h1>
        <p className="text-lg text-secondary max-w-2xl mx-auto">
          Track servers, resources and players across the FiveM ecosystem in real-time
        </p>
      </motion.div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-muted animate-spin" />
        </div>
      ) : stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
          <StatCard
            icon={<Server size={20} className="text-secondary" />}
            label="Total Servers"
            value={stats.totalServers}
            subValue={`${stats.serversOnline.toLocaleString()} online`}
            delay={0}
          />
          <StatCard
            icon={<Users size={20} className="text-secondary" />}
            label="Players Online"
            value={stats.totalPlayers}
            subValue={`~${stats.avgPlayersPerServer} avg/server`}
            delay={0.1}
          />
          <StatCard
            icon={<Package size={20} className="text-secondary" />}
            label="Unique Resources"
            value={stats.totalResources}
            delay={0.2}
          />
        </div>
      )}

      {/* Top Servers Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="mb-16"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface border border-border">
              <Activity size={18} className="text-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">Top Servers</h2>
          </div>
          <Link
            to="/servers"
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            View all
          </Link>
        </div>

        {loadingServers ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topServers.map((server, index) => (
              <ServerCard key={server.id || index} server={server} index={index} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Top Resources Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="mb-16"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-surface border border-border">
              <TrendingUp size={18} className="text-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-primary">Top Resources</h2>
          </div>
          <Link
            to="/resources"
            className="text-sm text-secondary hover:text-primary transition-colors"
          >
            View all
          </Link>
        </div>

        {loadingResources ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-muted animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topResources.map((resource, index) => (
              <ResourceCard key={resource.name} resource={resource} index={index} />
            ))}
          </div>
        )}
      </motion.section>

      {/* Features Section */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {[
          {
            icon: <Zap size={20} />,
            title: 'Real-time Data',
            description: 'Live data from the FiveM master server'
          },
          {
            icon: <Package size={20} />,
            title: 'Resource Analytics',
            description: 'See which resources are most used across all servers'
          },
          {
            icon: <TrendingUp size={20} />,
            title: 'Server Rankings',
            description: 'Discover the most popular FiveM servers'
          }
        ].map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.6 + index * 0.1 }}
            className="text-center p-6"
          >
            <div className="inline-flex p-3 rounded-xl bg-surface border border-border mb-4">
              <span className="text-secondary">{feature.icon}</span>
            </div>
            <h3 className="font-medium text-primary mb-2">{feature.title}</h3>
            <p className="text-sm text-muted">{feature.description}</p>
          </motion.div>
        ))}
      </motion.section>
    </div>
  )
}
