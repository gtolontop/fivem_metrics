import SearchServers from './SearchServers'
import { getServersDirect } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export default async function ServersPage() {
  const { servers, totalPlayers } = await getServersDirect()

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Servers</h1>
      <p className="text-muted mb-8">
        {servers.length.toLocaleString()} servers with {totalPlayers.toLocaleString()} players
      </p>

      <SearchServers servers={servers} />
    </div>
  )
}
