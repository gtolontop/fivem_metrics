import { NextResponse } from 'next/server'
import { getServersDirect } from '@/lib/fivem'
import { getCache, isCacheValid, updateServers } from '@/lib/cache'
import { getResources, isQueueEnabled } from '@/lib/queue'

export const dynamic = 'force-dynamic'

// Background refresh flag
let isRefreshing = false

async function refreshData() {
  if (isRefreshing) return
  isRefreshing = true

  try {
    const { servers, totalPlayers, totalServers } = await getServersDirect()
    if (servers.length > 0) {
      updateServers(servers, totalPlayers, totalServers)
    }
  } catch (e) {
    console.error('Background refresh failed:', e)
  } finally {
    isRefreshing = false
  }
}

// Only send top 100 servers to UI
const UI_SERVER_LIMIT = 100

export async function GET() {
  const cache = getCache()

  // Get resources from Redis if available
  const resources = isQueueEnabled() ? await getResources() : []

  // If cache is valid, return cached data and refresh in background
  if (isCacheValid()) {
    refreshData()

    return NextResponse.json({
      servers: cache.servers.slice(0, UI_SERVER_LIMIT),
      resources: resources.slice(0, 100),
      totalPlayers: cache.totalPlayers,
      totalServers: cache.totalServers,
      cached: true,
      lastUpdate: cache.lastUpdate
    })
  }

  // Cache is stale or empty, fetch fresh data
  try {
    const { servers, totalPlayers, totalServers } = await getServersDirect()

    // If FiveM API returned empty (rate limited), use stale cache
    if (servers.length === 0 && cache.servers.length > 0) {
      return NextResponse.json({
        servers: cache.servers.slice(0, UI_SERVER_LIMIT),
        resources: resources.slice(0, 100),
        totalPlayers: cache.totalPlayers,
        totalServers: cache.totalServers,
        cached: true,
        stale: true,
        rateLimited: true
      })
    }

    if (servers.length > 0) {
      updateServers(servers, totalPlayers, totalServers)
    }

    return NextResponse.json({
      servers: servers.slice(0, UI_SERVER_LIMIT),
      resources: resources.slice(0, 100),
      totalPlayers,
      totalServers,
      cached: false
    })
  } catch (error) {
    console.error('API error:', error)

    // Return cached data if available
    if (cache.servers.length > 0) {
      return NextResponse.json({
        servers: cache.servers.slice(0, UI_SERVER_LIMIT),
        resources: resources.slice(0, 100),
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
