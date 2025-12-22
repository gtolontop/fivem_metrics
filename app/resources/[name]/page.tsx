import Link from 'next/link'
import { ArrowLeft, Server, Users, ExternalLink } from 'lucide-react'
import ServerCard from '@/components/ServerCard'
import { getServersDirect } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export default async function ResourcePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const resourceName = decodeURIComponent(name)
  const { servers, resources } = await getServersDirect()

  const resource = resources.find(r => r.name === resourceName)
  const serversWithResource = servers.filter(s => s.resources.includes(resourceName))

  if (!resource) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-12 text-center">
        <p className="text-muted">Resource not found</p>
        <Link href="/resources" className="text-accent hover:underline mt-4 inline-block">Back to resources</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/resources" className="inline-flex items-center gap-2 text-muted hover:text-white mb-8 transition-colors">
        <ArrowLeft size={18} /> Back
      </Link>

      <div className="bg-card border border-border rounded-xl p-8 mb-6">
        <h1 className="text-2xl font-semibold font-mono mb-2">{resource.name}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-2"><Server size={20} /></div>
          <p className="text-sm text-muted mb-1">Servers Using</p>
          <p className="text-3xl font-semibold">{resource.servers.toLocaleString()}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="text-muted mb-2"><Users size={20} /></div>
          <p className="text-sm text-muted mb-1">Total Players</p>
          <p className="text-3xl font-semibold">{resource.players.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 mb-8">
        <h2 className="text-sm text-muted mb-4">Links</h2>
        <div className="flex gap-3">
          <a
            href={`https://github.com/search?q=${encodeURIComponent(resource.name)}&type=repositories`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-bg border border-border rounded-xl hover:border-zinc-600 transition-colors flex items-center gap-2"
          >
            <ExternalLink size={16} /> GitHub
          </a>
          <a
            href={`https://forum.cfx.re/search?q=${encodeURIComponent(resource.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-bg border border-border rounded-xl hover:border-zinc-600 transition-colors flex items-center gap-2"
          >
            <ExternalLink size={16} /> CFX Forum
          </a>
        </div>
      </div>

      {serversWithResource.length > 0 && (
        <>
          <h2 className="text-lg font-medium mb-4">Servers using {resource.name}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {serversWithResource.map((s, i) => <ServerCard key={s.id || i} server={s} />)}
          </div>
        </>
      )}
    </div>
  )
}
