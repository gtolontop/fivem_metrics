import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Server, Users, TrendingUp, Package } from 'lucide-react'
import type { Resource } from '../types'

interface ResourceCardProps {
  resource: Resource
  index: number
}

export default function ResourceCard({ resource, index }: ResourceCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link
        to={`/resources/${resource.name}`}
        className="block glass glass-hover rounded-2xl p-5 group"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface-hover border border-border group-hover:border-border-light transition-colors">
              <Package size={20} className="text-secondary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-primary group-hover:text-white transition-colors">
                  {resource.displayName}
                </h3>
                {resource.trending && (
                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-accent bg-accent/10 rounded-full">
                    <TrendingUp size={12} />
                    Trending
                  </span>
                )}
              </div>
              <p className="text-sm text-muted font-mono">{resource.name}</p>
            </div>
          </div>
          {resource.version && (
            <span className="text-xs text-muted font-mono bg-surface px-2 py-1 rounded-lg">
              v{resource.version}
            </span>
          )}
        </div>

        {resource.description && (
          <p className="text-sm text-secondary mb-4 line-clamp-2">
            {resource.description}
          </p>
        )}

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-muted" />
            <span className="text-sm">
              <span className="text-primary font-medium">
                {new Intl.NumberFormat().format(resource.serverCount)}
              </span>
              <span className="text-muted"> servers</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <span className="text-sm">
              <span className="text-primary font-medium">
                {new Intl.NumberFormat().format(resource.totalPlayers)}
              </span>
              <span className="text-muted"> players</span>
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-xs font-medium text-secondary bg-surface px-2.5 py-1 rounded-lg">
            {resource.category}
          </span>
          {resource.author && (
            <span className="text-xs text-muted">
              by {resource.author}
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  )
}
