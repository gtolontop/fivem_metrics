/**
 * Auto-initialization - tout se lance automatiquement
 * Uses FAST protobuf IP extraction (~89% direct IPs)
 */

import { getServersWithIps } from './fivem'
import { getCache, updateServers } from './cache'
import { initializeQueuesWithDirectIps, queueServersForScan, isQueueEnabled, getQueueStats } from './queue'
import { startBackgroundScanner } from './background-scan'
import { startBackgroundIpFetcher } from './background-ip'

let initialized = false
let initializing = false
let lastInitTime = 0
let workersStarted = false
const REINIT_INTERVAL = 10 * 60 * 1000 // Re-init toutes les 10 min

export async function autoInit(): Promise<{ success: boolean, message: string, stats?: object }> {
  // Déjà en cours
  if (initializing) {
    return { success: false, message: 'Initialization in progress...' }
  }

  // Pas besoin de re-init
  const now = Date.now()
  if (initialized && now - lastInitTime < REINIT_INTERVAL) {
    const stats = await getQueueStats()
    return { success: true, message: 'Already initialized', stats }
  }

  if (!isQueueEnabled()) {
    return { success: false, message: 'Redis not configured' }
  }

  initializing = true

  try {
    console.log('[Auto-Init] Starting with FAST IP extraction...')

    // 1. Load servers WITH direct IPs and player counts from protobuf (instant!)
    console.log('[Auto-Init] Loading servers from FiveM protobuf...')
    const { servers, directIps, playerCounts, needsResolution, totalPlayers, totalServers } = await getServersWithIps()

    if (servers.length === 0) {
      return { success: false, message: 'Failed to load servers from FiveM' }
    }

    updateServers(servers, totalPlayers, totalServers)
    console.log(`[Auto-Init] Loaded ${servers.length} servers`)
    console.log(`[Auto-Init] Got ${directIps.size} direct IPs instantly! (${(directIps.size / servers.length * 100).toFixed(1)}%)`)
    console.log(`[Auto-Init] Only ${needsResolution.length} need API resolution (${(needsResolution.length / servers.length * 100).toFixed(1)}%)`)

    // 2. Initialize queues with direct IPs and player counts (FAST path)
    console.log('[Auto-Init] Storing direct IPs, player counts, and queuing for scan...')
    const serverIds = servers.map(s => s.id)
    const { directIpsStored, needsApiFetch, queuedForScan } = await initializeQueuesWithDirectIps(
      serverIds,
      directIps,
      playerCounts,
      needsResolution
    )

    initialized = true
    lastInitTime = now

    // 3. Start background workers (Railway only)
    if (!workersStarted) {
      startBackgroundIpFetcher()  // Only for URL resolution (~11% of servers)
      startBackgroundScanner()     // Scan servers for resources
      workersStarted = true
      console.log('[Auto-Init] Background workers started (IP fetcher for URLs + scanner)')
    }

    const stats = await getQueueStats()
    console.log('[Auto-Init] Done!', stats)

    return {
      success: true,
      message: `FAST: ${directIpsStored} IPs instant, ${needsApiFetch} need API, ${queuedForScan} ready to scan`,
      stats
    }

  } catch (e) {
    console.error('[Auto-Init] Error:', e)
    return { success: false, message: String(e) }
  } finally {
    initializing = false
  }
}

export function isInitialized(): boolean {
  return initialized
}
