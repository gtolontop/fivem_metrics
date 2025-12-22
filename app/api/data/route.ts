import { NextResponse } from 'next/server'
import { getServersDirect } from '@/lib/fivem'
import { getCache, isCacheValid, updateServers, updateResources } from '@/lib/cache'

export const dynamic = 'force-dynamic'

// Background refresh flag to prevent multiple concurrent refreshes
let isRefreshing = false

async function refreshData() {
  if (isRefreshing) return
  isRefreshing = true

  try {
    const { servers, resources, totalPlayers, totalServers } = await getServersDirect()
    if (servers.length > 0) {
      updateServers(servers, totalPlayers, totalServers)
      if (resources.length > 0) {
        updateResources(resources)
      }
    }
  } catch (e) {
    console.error('Background refresh failed:', e)
  } finally {
    isRefreshing = false
  }
}

export async function GET() {
  const cache = getCache()

  // If cache is valid, return cached data and refresh in background
  if (isCacheValid()) {
    // Trigger background refresh without awaiting
    refreshData()

    return NextResponse.json({
      servers: cache.servers,
      resources: cache.resources,
      totalPlayers: cache.totalPlayers,
      totalServers: cache.totalServers,
      cached: true,
      lastUpdate: cache.lastUpdate
    })
  }

  // Cache is stale or empty, fetch fresh data
  try {
    const { servers, resources, totalPlayers, totalServers } = await getServersDirect()

    if (servers.length > 0) {
      updateServers(servers, totalPlayers, totalServers)
      if (resources.length > 0) {
        updateResources(resources)
      }
    }

    return NextResponse.json({
      servers,
      resources,
      totalPlayers,
      totalServers,
      cached: false
    })
  } catch (error) {
    console.error('API error:', error)

    // Return cached data if available, even if stale
    if (cache.servers.length > 0) {
      return NextResponse.json({
        servers: cache.servers,
        resources: cache.resources,
        totalPlayers: cache.totalPlayers,
        totalServers: cache.totalServers,
        cached: true,
        stale: true
      })
    }

    return NextResponse.json({
      servers: [],
      resources: [],
      totalPlayers: 0,
      totalServers: 0,
      error: 'Failed to fetch data'
    })
  }
}
