import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Server, Users, Package, TrendingUp, ExternalLink } from 'lucide-react'
import ServerCard from '../components/ServerCard'
import { resources, servers } from '../data/mockData'

export default function ResourceDetail() {
  const { name } = useParams()
  const resource = resources.find(r => r.name === name)

  if (!resource) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <p className="text-secondary">Resource not found</p>
          <Link to="/resources" className="text-accent hover:underline mt-4 inline-block">
            Back to resources
          </Link>
        </div>
      </div>
    )
  }

  const serversWithResource = servers.filter(s => s.resources.includes(resource.name))

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Back Button */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Link
          to="/resources"
          className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span>Back to resources</span>
        </Link>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass rounded-2xl p-8 mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-4 rounded-2xl bg-surface-hover border border-border">
              <Package size={32} className="text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl md:text-3xl font-semibold text-primary">
                  {resource.displayName}
                </h1>
                {resource.trending && (
                  <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent bg-accent/10 rounded-full">
                    <TrendingUp size={14} />
                    Trending
                  </span>
                )}
              </div>
              <p className="text-muted font-mono text-sm">{resource.name}</p>
              {resource.author && (
                <p className="text-secondary text-sm mt-2">
                  by <span className="text-primary">{resource.author}</span>
                </p>
              )}
            </div>
          </div>

          {resource.version && (
            <span className="text-sm text-muted font-mono bg-surface px-3 py-1.5 rounded-lg border border-border self-start">
              v{resource.version}
            </span>
          )}
        </div>

        {resource.description && (
          <p className="text-secondary mt-6 text-lg">
            {resource.description}
          </p>
        )}
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          {
            icon: <Server size={20} />,
            label: 'Servers Using',
            value: resource.serverCount.toLocaleString(),
          },
          {
            icon: <Users size={20} />,
            label: 'Total Players',
            value: resource.totalPlayers.toLocaleString(),
          },
          {
            icon: <Package size={20} />,
            label: 'Category',
            value: resource.category,
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
            className="glass rounded-xl p-6"
          >
            <div className="text-muted mb-3">{stat.icon}</div>
            <p className="text-sm text-muted mb-1">{stat.label}</p>
            <p className="text-2xl font-semibold text-primary">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Links */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="glass rounded-xl p-6 mb-8"
      >
        <h2 className="text-sm font-medium text-muted mb-4">Links</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={`https://github.com/search?q=${resource.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ExternalLink size={16} />
            GitHub
          </a>
          <a
            href={`https://forum.cfx.re/search?q=${resource.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ExternalLink size={16} />
            CFX Forum
          </a>
        </div>
      </motion.div>

      {/* Servers Using This Resource */}
      {serversWithResource.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <h2 className="text-lg font-medium text-primary mb-4">
            Servers using {resource.displayName}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {serversWithResource.map((server, index) => (
              <ServerCard key={server.id} server={server} index={index} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
