import { NextResponse } from 'next/server'
import { initializeQueues, queueServersForScan, isQueueEnabled, resetQueues } from '@/lib/queue'
import { getCache } from '@/lib/cache'

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
 *   scanOnly: boolean    // Seulement queue les serveurs pour scan (ont déjà des IPs)
 * }
 */
export async function POST(request: Request) {
  if (!isQueueEnabled()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const cache = getCache()

  if (cache.servers.length === 0) {
    return NextResponse.json({
      error: 'No servers in cache. Load data first via /api/data',
      hint: 'Call GET /api/data to fetch the server list'
    }, { status: 400 })
  }

  let body: { reset?: boolean, scanOnly?: boolean } = {}
  try {
    body = await request.json()
  } catch {
    // No body is fine
  }

  if (body.reset) {
    await resetQueues()
  }

  let result

  if (body.scanOnly) {
    // Seulement ajouter à la queue de scan les serveurs qui ont une IP
    const queued = await queueServersForScan()
    result = { queuedForScan: queued }
  } else {
    // Initialiser les queues avec tous les serveurs
    const serverIds = cache.servers.map(s => s.id)
    const { added, skipped } = await initializeQueues(serverIds)

    // Aussi queue les serveurs avec IP pour scan
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
