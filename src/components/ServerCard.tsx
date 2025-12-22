import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, TrendingUp, Package } from 'lucide-react'
import type { Server } from '../types'

interface ServerCardProps {
  server: Server
  index: number
}

function stripColorCodes(str: string): string {
  return str.replace(/\^[0-9]/g, '').replace(/\~[a-z]~\~/gi, '')
}

export default function ServerCard({ server, index }: ServerCardProps) {
  const playerPercentage = (server.players / server.maxPlayers) * 100
  const cleanName = stripColorCodes(server.name)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.03 }}
    >
      <Link
        to={`/servers/${encodeURIComponent(server.endpoint || server.id)}`}
        className="block glass glass-hover rounded-2xl p-5 group"
      >
        <div className="flex items-start gap-4 mb-4">
          {server.icon && (
            <img
              src={server.icon}
              alt=""
              className="w-12 h-12 rounded-xl object-cover bg-surface flex-shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-primary truncate group-hover:text-white transition-colors">
              {cleanName}
            </h3>
            {server.gametype && (
              <p className="text-sm text-muted truncate">
                {server.gametype}
              </p>
            )}
          </div>
          {server.upvotePower > 0 && (
            <div className="flex items-center gap-1 text-accent">
              <TrendingUp size={14} />
              <span className="text-xs font-medium">{server.upvotePower}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2 text-secondary">
            <Users size={16} />
            <span className="text-sm">
              <span className="text-primary font-medium">{server.players.toLocaleString()}</span>
              <span className="text-muted">/{server.maxPlayers}</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-secondary">
            <Package size={16} />
            <span className="text-sm">{server.resources?.length || 0} resources</span>
          </div>
        </div>

        <div className="mb-4">
          <div className="h-1.5 bg-surface rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(playerPercentage, 100)}%` }}
              transition={{ duration: 0.8, delay: index * 0.03 + 0.2 }}
              className={`h-full rounded-full ${
                playerPercentage > 90 ? 'bg-red-500' : playerPercentage > 70 ? 'bg-warning' : 'bg-accent'
              }`}
            />
          </div>
        </div>

        {server.vars?.tags && (
          <div className="flex flex-wrap gap-2">
            {String(server.vars.tags).split(',').slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-xs font-medium text-secondary bg-surface rounded-lg"
              >
                {tag.trim()}
              </span>
            ))}
          </div>
        )}
      </Link>
    </motion.div>
  )
}
