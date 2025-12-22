import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Server, Users, Package } from 'lucide-react'
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
      transition={{ duration: 0.4, delay: index * 0.03 }}
    >
      <Link
        to={`/resources/${encodeURIComponent(resource.name)}`}
        className="block glass glass-hover rounded-2xl p-5 group"
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-surface-hover border border-border group-hover:border-border-light transition-colors">
              <Package size={20} className="text-secondary" />
            </div>
            <div>
              <h3 className="font-medium text-primary group-hover:text-white transition-colors font-mono">
                {resource.name}
              </h3>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <Server size={16} className="text-muted" />
            <span className="text-sm">
              <span className="text-primary font-medium">
                {resource.serverCount.toLocaleString()}
              </span>
              <span className="text-muted"> servers</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-muted" />
            <span className="text-sm">
              <span className="text-primary font-medium">
                {resource.totalPlayers.toLocaleString()}
              </span>
              <span className="text-muted"> players</span>
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
