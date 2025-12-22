import SearchResources from './SearchResources'
import { getServersDirect } from '@/lib/fivem'

export const dynamic = 'force-dynamic'

export default async function ResourcesPage() {
  const { resources } = await getServersDirect()

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold mb-2">Resources</h1>
      <p className="text-muted mb-8">{resources.length.toLocaleString()} unique resources tracked</p>

      <SearchResources resources={resources} />
    </div>
  )
}
