import { NextResponse } from 'next/server'
import { initializeQueues, initializeQueuesWithDirectIps, queueServersForScan, isQueueEnabled, resetQueues, resetAll } from '@/lib/queue'
import { getCache, updateServers } from '@/lib/cache'
import { getServersWithIps } from '@/lib/fivem'
import { startBackgroundScanner } from '@/lib/background-scan'

export const dynamic = 'force-dynamic'

/**
 * POST /api/queue/init
 *
 * Initialise les queues avec la liste des serveurs.
 * Appelé au démarrage ou pour réinitialiser.
 *
 * Body optionnel:
 * {
 *   reset: boolean,      // Reset les queues avant d'initialiser
 *   scanOnly: boolean,   // Seulement queue les serveurs pour scan (ont déjà des IPs)
 *   force: boolean       // FULL RESET: fetch fresh data, clean stale entries, restart scanner
 * }
 */
export async function POST(request: Request) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  let body: { reset?: boolean, scanOnly?: boolean, force?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine
  }

  // FORCE MODE: Full reset with fresh protobuf data
  if (body.force) {
    console.log('[Init] FORCE MODE: Full reset starting...')

    // 1. Reset ALL data
    await resetAll()
    console.log('[Init] All data reset')

    // 2. Fetch fresh protobuf data
    const { servers, directIps, playerCounts, needsResolution, totalPlayers, totalServers } = await getServersWithIps()

    if (servers.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch servers from FiveM' }, { status: 500 })
    }

    // 3. Update cache
    updateServers(servers, totalPlayers, totalServers)
    console.log(`[Init] Loaded ${servers.length} servers, ${directIps.size} direct IPs`)

    // 4. Initialize queues with cleanup (new function handles stale data)
    const serverIds = servers.map(s => s.id)
    const { directIpsStored, needsApiFetch, queuedForScan } = await initializeQueuesWithDirectIps(
      serverIds,
      directIps,
      playerCounts,
      needsResolution
    )

    // 5. Start background scanner
    startBackgroundScanner()
    console.log('[Init] Scanner started')

    return NextResponse.json({
      success: true,
      mode: 'force',
      totalServers: servers.length,
      directIpsStored,
      needsApiFetch,
      queuedForScan,
      scannerStarted: true
    })
  }

  // Normal init (legacy)
  const cache = getCache()

  if (cache.servers.length === 0) {
    return NextResponse.json({
      error: 'No servers in cache. Use force=true to fetch fresh data',
      hint: 'POST /api/queue/init with body { "force": true }'
    }, { status: 400 })
  }

  if (body.reset) {
    await resetQueues()
  }

  let result

  if (body.scanOnly) {
    const queued = await queueServersForScan()
    result = { queuedForScan: queued }
  } else {
    const serverIds = cache.servers.map(s => s.id)
    const { added, skipped } = await initializeQueues(serverIds)
    const queuedForScan = await queueServersForScan()

    result = {
      totalServers: serverIds.length,
      queuedForIpFetch: added,
      alreadyHaveIp: skipped,
      queuedForScan
    }
  }

  return NextResponse.json({
    success: true,
    ...result
  })
}

/**
 * GET /api/queue/init
 *
 * Retourne les instructions pour initialiser.
 */
export async function GET() {
  return NextResponse.json({
    usage: 'POST /api/queue/init',
    options: {
      reset: 'boolean - Reset queues before init',
      scanOnly: 'boolean - Only queue servers for scan (already have IPs)'
    },
    example: {
      method: 'POST',
      body: { reset: false }
    }
  })
}
