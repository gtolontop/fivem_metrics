import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Server, Users, Package, ExternalLink, Loader2 } from 'lucide-react'
import ServerCard from '../components/ServerCard'
import { useResources } from '../hooks/useResources'
import { useServers } from '../hooks/useServers'

export default function ResourceDetail() {
  const { name } = useParams()
  const { resources, loading: loadingResources } = useResources()
  const { servers, loading: loadingServers } = useServers()

  const decodedName = name ? decodeURIComponent(name) : ''
  const resource = resources.find(r => r.name === decodedName)
  const serversWithResource = servers.filter(s =>
    s.resources?.includes(decodedName)
  ).slice(0, 12)

  if (loadingResources || loadingServers) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-muted animate-spin" />
        </div>
      </div>
    )
  }

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
              <h1 className="text-2xl md:text-3xl font-semibold text-primary font-mono">
                {resource.name}
              </h1>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass rounded-xl p-6"
        >
          <div className="text-muted mb-3">
            <Server size={20} />
          </div>
          <p className="text-sm text-muted mb-1">Servers Using</p>
          <p className="text-3xl font-semibold text-primary">
            {resource.serverCount.toLocaleString()}
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="glass rounded-xl p-6"
        >
          <div className="text-muted mb-3">
            <Users size={20} />
          </div>
          <p className="text-sm text-muted mb-1">Total Players</p>
          <p className="text-3xl font-semibold text-primary">
            {resource.totalPlayers.toLocaleString()}
          </p>
        </motion.div>
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
            href={`https://github.com/search?q=${encodeURIComponent(resource.name)}&type=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ExternalLink size={16} />
            GitHub
          </a>
          <a
            href={`https://forum.cfx.re/search?q=${encodeURIComponent(resource.name)}`}
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
            Servers using {resource.name}
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {serversWithResource.map((server, index) => (
              <ServerCard key={server.endpoint || index} server={server} index={index} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
