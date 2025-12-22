import { Server, Users, Package } from 'lucide-react'
import Link from 'next/link'
import ServerCard from '@/components/ServerCard'
import ResourceCard from '@/components/ResourceCard'
import { getServersDirect } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const { servers, resources, totalPlayers } = await getServersDirect()

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
        <p className="text-muted text-lg">Real-time tracking of servers and resources</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
        <Stat icon={<Server size={20} />} label="Servers" value={servers.length} />
        <Stat icon={<Users size={20} />} label="Players Online" value={totalPlayers} />
        <Stat icon={<Package size={20} />} label="Resources" value={resources.length} />
      </div>

      <section className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Servers</h2>
          <Link href="/servers" className="text-sm text-muted hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.slice(0, 6).map((s, i) => <ServerCard key={s.id || i} server={s} />)}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Resources</h2>
          <Link href="/resources" className="text-sm text-muted hover:text-white">View all</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.slice(0, 6).map((r) => <ResourceCard key={r.name} resource={r} />)}
        </div>
      </section>
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="text-muted mb-3">{icon}</div>
      <p className="text-sm text-muted mb-1">{label}</p>
      <p className="text-3xl font-semibold">{value.toLocaleString()}</p>
    </div>
  )
}
