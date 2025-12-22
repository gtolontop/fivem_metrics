import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Signal, Globe } from 'lucide-react'
import type { Server } from '../types'

interface ServerCardProps {
  server: Server
  index: number
}

const countryFlags: Record<string, string> = {
  FR: '🇫🇷',
  US: '🇺🇸',
  DE: '🇩🇪',
  UK: '🇬🇧',
  NL: '🇳🇱',
  BR: '🇧🇷',
  AU: '🇦🇺',
}

export default function ServerCard({ server, index }: ServerCardProps) {
  const playerPercentage = (server.players / server.maxPlayers) * 100

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        to={`/servers/${server.id}`}
        className="block glass glass-hover rounded-2xl p-5 group"
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{countryFlags[server.country] || '🌍'}</span>
              <h3 className="font-medium text-primary truncate group-hover:text-white transition-colors">
                {server.name}
              </h3>
            </div>
            <p className="text-sm text-muted font-mono">
              {server.ip}:{server.port}
            </p>
          </div>
          <div className="flex items-center gap-1 text-success">
            <Signal size={14} />
            <span className="text-sm font-medium">{server.ping}ms</span>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-secondary">
            <Users size={16} />
            <span className="text-sm">
              <span className="text-primary font-medium">{server.players}</span>
              <span className="text-muted">/{server.maxPlayers}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-secondary">
            <Globe size={16} />
            <span className="text-sm">{server.resources.length} resources</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${playerPercentage}%` }}
              transition={{ duration: 0.8, delay: index * 0.05 + 0.2 }}
              className={`h-full rounded-full ${
                playerPercentage > 80 ? 'bg-warning' : 'bg-accent'
              }`}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {server.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-xs font-medium text-secondary bg-surface rounded-lg"
            >
              {tag}
            </span>
          ))}
          {server.tags.length > 3 && (
            <span className="px-2.5 py-1 text-xs font-medium text-muted">
              +{server.tags.length - 3}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
