/**
 * Auto-initialization - tout se lance automatiquement
 */

import { getServersDirect } from './fivem'
import { getCache, updateServers } from './cache'
import { initializeQueues, queueServersForScan, isQueueEnabled, getQueueStats } from './queue'
import { startBackgroundScanner } from './background-scan'

let initialized = false
let initializing = false
let lastInitTime = 0
let scannerStarted = false
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
    console.log('[Auto-Init] Starting...')

    // 1. Charger les serveurs FiveM
    const cache = getCache()
    if (cache.servers.length === 0) {
      console.log('[Auto-Init] Loading servers from FiveM...')
      const { servers, totalPlayers, totalServers } = await getServersDirect()
      if (servers.length > 0) {
        updateServers(servers, totalPlayers, totalServers)
        console.log(`[Auto-Init] Loaded ${servers.length} servers`)
      } else {
        return { success: false, message: 'Failed to load servers from FiveM' }
      }
    }

    // 2. Initialiser les queues
    console.log('[Auto-Init] Initializing queues...')
    const serverIds = getCache().servers.map(s => s.id)
    const { added, skipped } = await initializeQueues(serverIds)
    console.log(`[Auto-Init] Queued ${added} for IP fetch, ${skipped} already have IP`)

    // 3. Queue les serveurs avec IP pour scan
    const scanQueued = await queueServersForScan()
    console.log(`[Auto-Init] Queued ${scanQueued} for scan`)

    initialized = true
    lastInitTime = now

    // 4. Start background scanner (Railway can do HTTP, CF Workers can't)
    if (!scannerStarted) {
      startBackgroundScanner()
      scannerStarted = true
      console.log('[Auto-Init] Background scanner started')
    }

    const stats = await getQueueStats()
    console.log('[Auto-Init] Done!', stats)

    return {
      success: true,
      message: `Initialized: ${added} to fetch, ${skipped} have IP, ${scanQueued} to scan`,
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
