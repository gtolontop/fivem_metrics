import ResourceCard from '@/components/ResourceCard'
import SearchResources from './SearchResources'

async function getResources() {
  const res = await fetch('https://servers-frontend.fivem.net/api/servers/streamRedir/', {
    headers: { 'User-Agent': 'FiveM-Metrics/1.0' },
    next: { revalidate: 60 }
  })
  const text = await res.text()
  const lines = text.split('\n').filter(l => l.trim())

  const resourceMap = new Map<string, { name: string; servers: number; players: number }>()

  for (const line of lines) {
    try {
      const s = JSON.parse(line)
      if (s.Data) {
        for (const r of s.Data.resources || []) {
          if (!r || r.length < 2) continue
          const existing = resourceMap.get(r) || { name: r, servers: 0, players: 0 }
          existing.servers++
          existing.players += s.Data.clients || 0
          resourceMap.set(r, existing)
        }
      }
    } catch {}
  }

  return Array.from(resourceMap.values()).sort((a, b) => b.servers - a.servers)
}

export default async function ResourcesPage() {
  const resources = await getResources()

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-8">{resources.length.toLocaleString()} unique resources tracked</p>

      <SearchResources resources={resources} />
    </div>
  )
}
