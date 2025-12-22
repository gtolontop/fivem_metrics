/**
 * Cloudflare Worker - FREE tier: 100k requests/day
 *
 * Utilise le nouveau système de queue:
 * - GET /work - Récupère du travail
 * - POST /submit - Soumet les résultats
 *
 * Modes:
 * - /work - Récupère et exécute un batch de travail
 * - /health - Health check
 */

interface Env {
  API_BASE: string
}

interface WorkerTask {
  type: 'ip_fetch' | 'scan'
  serverId: string
  ip?: string
}

interface IpResult {
  serverId: string
  ip: string | null
  error?: string
}

interface ScanResult {
  serverId: string
  ip: string
  online: boolean
  resources?: string[]
  players?: number
  error?: string
}

async function fetchIp(serverId: string): Promise<IpResult> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (res.status === 429) {
      return { serverId, ip: null, error: 'rate_limited' }
    }

    if (!res.ok) {
      return { serverId, ip: null, error: `http_${res.status}` }
    }

    const data = await res.json() as { Data?: { connectEndPoints?: string[] } }
    const ip = data.Data?.connectEndPoints?.[0] || null
    return { serverId, ip }
  } catch (e) {
    return { serverId, ip: null, error: String(e) }
  }
}

async function scanServer(serverId: string, ip: string): Promise<ScanResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`http://${ip}/info.json`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    clearTimeout(timeout)

    if (!res.ok) {
      return { serverId, ip, online: false, error: `http_${res.status}` }
    }

    const data = await res.json() as { resources?: string[], vars?: { sv_maxClients?: string } }
    return {
      serverId,
      ip,
      online: true,
      resources: data.resources || [],
      players: data.vars?.sv_maxClients ? parseInt(data.vars.sv_maxClients) : 0
    }
  } catch (e) {
    return { serverId, ip, online: false, error: String(e) }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK')
    }

    // Main endpoint: Get work and execute it
    if (url.pathname === '/work') {
      const startTime = Date.now()
      const preferType = url.searchParams.get('type') || 'ip_fetch'

      try {
        // 1. Get work from queue
        const workRes = await fetch(`${env.API_BASE}/api/queue/work?worker=cloudflare&type=${preferType}`)
        const workData = await workRes.json() as { tasks: WorkerTask[], count: number }

        if (!workData.tasks?.length) {
          return Response.json({ message: 'No work available', timeMs: Date.now() - startTime })
        }

        // 2. Split tasks by type
        const ipTasks = workData.tasks.filter(t => t.type === 'ip_fetch')
        const scanTasks = workData.tasks.filter(t => t.type === 'scan')

        // 3. Execute IP fetches
        let ipResults: IpResult[] = []
        if (ipTasks.length > 0) {
          ipResults = await Promise.all(ipTasks.map(t => fetchIp(t.serverId)))

          // Submit IP results
          await fetch(`${env.API_BASE}/api/queue/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ip_results',
              results: ipResults,
              workerId: 'cloudflare'
            })
          })
        }

        // 4. Execute scans
        let scanResults: ScanResult[] = []
        if (scanTasks.length > 0) {
          scanResults = await Promise.all(
            scanTasks
              .filter(t => t.ip)
              .map(t => scanServer(t.serverId, t.ip!))
          )

          // Submit scan results
          await fetch(`${env.API_BASE}/api/queue/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'scan_results',
              results: scanResults,
              workerId: 'cloudflare'
            })
          })
        }

        const ipSuccess = ipResults.filter(r => r.ip !== null).length
        const scanOnline = scanResults.filter(r => r.online).length

        return Response.json({
          tasks: workData.count,
          ip: {
            total: ipTasks.length,
            success: ipSuccess,
            failed: ipTasks.length - ipSuccess
          },
          scan: {
            total: scanTasks.length,
            online: scanOnline,
            offline: scanTasks.length - scanOnline
          },
          timeMs: Date.now() - startTime
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // Multi-round mode: Run multiple batches in parallel
    if (url.pathname === '/rapid') {
      const rounds = parseInt(url.searchParams.get('rounds') || '3')
      const preferType = url.searchParams.get('type') || 'ip_fetch'
      const startTime = Date.now()

      const promises = Array(rounds).fill(null).map(async (_, i) => {
        // Stagger requests slightly
        await new Promise(r => setTimeout(r, i * 100))

        try {
          const res = await fetch(`${url.origin}/work?type=${preferType}`, {
            headers: request.headers
          })
          return await res.json()
        } catch (e) {
          return { error: String(e), round: i }
        }
      })

      const results = await Promise.all(promises)

      const totals = {
        tasks: 0,
        ipSuccess: 0,
        ipFailed: 0,
        scanOnline: 0,
        scanOffline: 0
      }

      for (const r of results) {
        if (r.tasks) {
          totals.tasks += r.tasks
          totals.ipSuccess += r.ip?.success || 0
          totals.ipFailed += r.ip?.failed || 0
          totals.scanOnline += r.scan?.online || 0
          totals.scanOffline += r.scan?.offline || 0
        }
      }

      return Response.json({
        mode: 'rapid',
        rounds,
        totals,
        details: results,
        timeMs: Date.now() - startTime
      })
    }

    // Info
    return Response.json({
      name: 'FiveM Metrics Worker',
      endpoints: [
        '/work?type=ip_fetch|scan - Get and execute work batch',
        '/rapid?rounds=3&type=ip_fetch - Run multiple rounds',
        '/health - Health check'
      ],
      note: 'Uses new queue system at /api/queue/*'
    })
  },

  // Cron trigger: Run work every minute
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Run 3 rounds of IP fetch on each cron
    ctx.waitUntil(
      fetch(`https://${new URL(env.API_BASE).hostname}/rapid?rounds=3&type=ip_fetch`)
        .catch(() => {}) // Ignore errors
    )
  }
}
