'use client'

import { Server, Users, Package, TrendingUp, Wifi, WifiOff } from 'lucide-react'
import Link from 'next/link'
import { useRealtimeStats } from '@/lib/useRealtimeStats'
import { AnimatedCounter } from '@/components/AnimatedCounter'

export default function Home() {
  const { data, connected } = useRealtimeStats()

  if (!data) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-semibold mb-4">FiveM Metrics</h1>
          <p className="text-muted text-lg">Connecting...</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-bg rounded w-1/2 mb-3"></div>
              <div className="h-8 bg-bg rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <div className="flex items-center justify-center gap-3 mb-4">
          <h1 className="text-5xl font-semibold">FiveM Metrics</h1>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
            connected ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {connected ? 'Live' : 'Reconnecting'}
          </span>
        </div>
        <p className="text-muted text-lg">Real-time FiveM server & resource analytics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-3">
            <Server size={18} />
            <span className="text-sm">Total Servers</span>
          </div>
          <p className="text-3xl font-semibold">
            <AnimatedCounter value={data.totalServers} />
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-3">
            <TrendingUp size={18} />
            <span className="text-sm">Online</span>
          </div>
          <p className="text-3xl font-semibold text-green-400">
            <AnimatedCounter value={data.serversOnline} />
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-3">
            <Package size={18} />
            <span className="text-sm">Resources</span>
          </div>
          <p className="text-3xl font-semibold">
            <AnimatedCounter value={data.totalResources} />
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 text-muted mb-3">
            <Users size={18} />
            <span className="text-sm">Scanned</span>
          </div>
          <p className="text-3xl font-semibold">
            <AnimatedCounter value={data.serversScanned} />
          </p>
        </div>
      </div>

      {/* Top Resources */}
      <section className="mb-16">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-medium">Top Resources</h2>
          <Link href="/resources" className="text-sm text-muted hover:text-white transition-colors">
            View all {data.totalResources.toLocaleString()}
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.resources.slice(0, 6).map((resource) => (
            <Link
              key={resource.name}
              href={`/resources/${encodeURIComponent(resource.name)}`}
              className="block bg-card border border-border rounded-xl p-5 hover:border-zinc-600 transition-colors group"
            >
              <h3 className="font-mono font-medium truncate mb-3 group-hover:text-white transition-colors">
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
          ))}
        </div>
      </section>

      {/* Progress Section */}
      {(data.ipProgress < 100 || data.scanProgress < 100) && (
        <section className="mb-16">
          <h2 className="text-xl font-medium mb-6">Scan Progress</h2>
          <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted">IP Collection</span>
                <span><AnimatedCounter value={data.ipProgress} />%</span>
              </div>
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-500"
                  style={{ width: `${data.ipProgress}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted">Resource Scan</span>
                <span><AnimatedCounter value={data.scanProgress} />%</span>
              </div>
              <div className="h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-500"
                  style={{ width: `${data.scanProgress}%` }}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Quick Links */}
      <section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/resources"
            className="bg-card border border-border rounded-xl p-6 hover:border-zinc-600 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Package size={24} className="text-accent" />
              <h3 className="text-lg font-medium group-hover:text-white transition-colors">Browse Resources</h3>
            </div>
            <p className="text-muted text-sm">
              Search through {data.totalResources.toLocaleString()} unique FiveM resources
            </p>
          </Link>
          <Link
            href="/servers"
            className="bg-card border border-border rounded-xl p-6 hover:border-zinc-600 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-2">
              <Server size={24} className="text-blue-400" />
              <h3 className="text-lg font-medium group-hover:text-white transition-colors">Browse Servers</h3>
            </div>
            <p className="text-muted text-sm">
              Explore {data.serversOnline.toLocaleString()} online servers
            </p>
          </Link>
        </div>
      </section>
    </div>
  )
}
