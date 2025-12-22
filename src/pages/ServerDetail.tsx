import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Users, Package, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { api, ServerData } from '../services/api'

function stripColorCodes(str: string): string {
  return str.replace(/\^[0-9]/g, '').replace(/\~[a-z]~\~/gi, '')
}

export default function ServerDetail() {
  const { id } = useParams()
  const [server, setServer] = useState<ServerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!id) return

    async function fetchServer() {
      try {
        setLoading(true)
        const data = await api.getServer(decodeURIComponent(id))
        if (data.Data) {
          setServer({
            id: data.EndPoint || id,
            endpoint: data.EndPoint || id,
            name: data.Data.hostname || 'Unknown',
            players: data.Data.clients || 0,
            maxPlayers: data.Data.sv_maxclients || 32,
            gametype: data.Data.gametype || '',
            mapname: data.Data.mapname || '',
            resources: data.Data.resources || [],
            vars: data.Data.vars || {},
            icon: data.Data.icon || null,
            upvotePower: data.Data.upvotePower || 0,
            ownerName: data.Data.ownerName || null,
            ownerAvatar: data.Data.ownerAvatar || null
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load server')
      } finally {
        setLoading(false)
      }
    }

    fetchServer()
  }, [id])

  const copyConnect = () => {
    if (!id) return
    navigator.clipboard.writeText(`connect ${decodeURIComponent(id)}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-muted animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !server) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center py-20">
          <p className="text-secondary">{error || 'Server not found'}</p>
          <Link to="/servers" className="text-accent hover:underline mt-4 inline-block">
            Back to servers
          </Link>
        </div>
      </div>
    )
  }

  const playerPercentage = (server.players / server.maxPlayers) * 100
  const cleanName = stripColorCodes(server.name)

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
          <div className="flex items-start gap-4">
            {server.icon && (
              <img
                src={server.icon}
                alt=""
                className="w-16 h-16 rounded-xl object-cover bg-surface"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            )}
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-primary mb-1">
                {cleanName}
              </h1>
              {server.gametype && (
                <p className="text-muted">{server.gametype}</p>
              )}
              <p className="text-muted font-mono text-sm mt-2">
                {server.endpoint}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={copyConnect}
              className="btn-secondary flex items-center gap-2"
            >
              {copied ? <Check size={18} /> : <Copy size={18} />}
              {copied ? 'Copied!' : 'Copy Connect'}
            </button>
            <a
              href={`https://cfx.re/join/${server.endpoint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2"
            >
              <ExternalLink size={18} />
              Join
            </a>
          </div>
        </div>

        {/* Player Bar */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-muted" />
              <span className="text-sm text-secondary">Players</span>
            </div>
            <span className="text-sm">
              <span className="text-primary font-medium">{server.players.toLocaleString()}</span>
              <span className="text-muted"> / {server.maxPlayers}</span>
            </span>
          </div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(playerPercentage, 100)}%` }}
              transition={{ duration: 0.8 }}
              className={`h-full rounded-full ${
                playerPercentage > 90 ? 'bg-red-500' : playerPercentage > 70 ? 'bg-warning' : 'bg-accent'
              }`}
            />
          </div>
        </div>
      </motion.div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Players', value: `${server.players}/${server.maxPlayers}` },
          { label: 'Gamemode', value: server.gametype || 'N/A' },
          { label: 'Map', value: server.mapname || 'N/A' },
          { label: 'Resources', value: server.resources?.length || 0 },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + index * 0.05 }}
            className="glass rounded-xl p-4"
          >
            <p className="text-xs text-muted mb-1">{stat.label}</p>
            <p className="text-lg font-medium text-primary truncate">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Tags */}
      {server.vars?.tags && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="glass rounded-xl p-6 mb-6"
        >
          <h2 className="text-sm font-medium text-muted mb-4">Tags</h2>
          <div className="flex flex-wrap gap-2">
            {String(server.vars.tags).split(',').map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 text-sm font-medium text-secondary bg-surface rounded-lg border border-border"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        </motion.div>
      )}

      {/* Resources */}
      {server.resources && server.resources.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="glass rounded-xl p-6"
        >
          <h2 className="text-sm font-medium text-muted mb-4">
            Resources ({server.resources.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {server.resources.map((resource) => (
              <Link
                key={resource}
                to={`/resources/${encodeURIComponent(resource)}`}
                className="px-3 py-2 text-sm font-mono text-secondary bg-surface rounded-lg border border-border hover:border-border-light hover:text-primary transition-all truncate"
              >
                {resource}
              </Link>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
