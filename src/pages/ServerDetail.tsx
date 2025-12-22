import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Signal, Globe, Clock, Package, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { servers } from '../data/mockData'

const countryFlags: Record<string, string> = {
  FR: '🇫🇷',
  US: '🇺🇸',
  DE: '🇩🇪',
  UK: '🇬🇧',
  NL: '🇳🇱',
  BR: '🇧🇷',
  AU: '🇦🇺',
}

export default function ServerDetail() {
  const { id } = useParams()
  const [copied, setCopied] = useState(false)
  const server = servers.find(s => s.id === id)

  if (!server) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <p className="text-secondary">Server not found</p>
          <Link to="/servers" className="text-accent hover:underline mt-4 inline-block">
            Back to servers
          </Link>
        </div>
      </div>
    )
  }

  const connectUrl = `cfx.re/join/${server.id}`
  const playerPercentage = (server.players / server.maxPlayers) * 100

  const copyConnect = () => {
    navigator.clipboard.writeText(connectUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
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
          to="/servers"
          className="inline-flex items-center gap-2 text-secondary hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span>Back to servers</span>
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
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{countryFlags[server.country] || '🌍'}</span>
              <h1 className="text-2xl md:text-3xl font-semibold text-primary">
                {server.name}
              </h1>
            </div>
            <p className="text-muted font-mono">
              {server.ip}:{server.port}
            </p>
          </div>

          <button
            onClick={copyConnect}
            className="btn-secondary flex items-center gap-2 self-start"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy Connect'}
          </button>
        </div>

        {/* Player Bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-muted" />
              <span className="text-sm text-secondary">Players</span>
            </div>
            <span className="text-sm">
              <span className="text-primary font-medium">{server.players}</span>
              <span className="text-muted"> / {server.maxPlayers}</span>
            </span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${playerPercentage}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${
                playerPercentage > 80 ? 'bg-warning' : 'bg-accent'
              }`}
            />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: <Signal size={18} />, label: 'Ping', value: `${server.ping}ms` },
          { icon: <Clock size={18} />, label: 'Uptime', value: `${server.uptime}%` },
          { icon: <Package size={18} />, label: 'Resources', value: server.resources.length },
          { icon: <Globe size={18} />, label: 'Region', value: server.country },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <div className="text-muted mb-2">{stat.icon}</div>
            <p className="text-xs text-muted mb-1">{stat.label}</p>
            <p className="text-lg font-medium text-primary">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tags */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        className="glass rounded-xl p-6 mb-6"
      >
        <h2 className="text-sm font-medium text-muted mb-4">Tags</h2>
        <div className="flex flex-wrap gap-2">
          {server.tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 text-sm font-medium text-secondary bg-surface rounded-lg border border-border"
            >
              {tag}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Resources */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="glass rounded-xl p-6"
      >
        <h2 className="text-sm font-medium text-muted mb-4">Resources ({server.resources.length})</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {server.resources.map((resource) => (
            <Link
              key={resource}
              to={`/resources/${resource}`}
              className="px-3 py-2 text-sm font-mono text-secondary bg-surface rounded-lg border border-border hover:border-border-light hover:text-primary transition-all"
            >
              {resource}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
