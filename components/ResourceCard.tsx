import Link from 'next/link'
import { Server, Users } from 'lucide-react'

interface Resource {
  name: string
  servers: number
  players: number
}

export default function ResourceCard({ resource }: { resource: Resource }) {
  return (
    <Link
      href={`/resources/${encodeURIComponent(resource.name)}`}
      className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
    >
      <h3 className="font-mono font-medium mb-4 truncate group-hover:text-white transition-colors">
        {resource.name}
      </h3>

      <div className="flex items-center gap-6 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <Server size={14} />
          <span className="text-white">{resource.servers.toLocaleString()}</span> servers
        </span>
        <span className="flex items-center gap-1.5">
          <Users size={14} />
          <span className="text-white">{resource.players.toLocaleString()}</span> players
        </span>
      </div>
    </Link>
  )
}
