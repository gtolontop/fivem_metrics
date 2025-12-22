// Cloudflare Worker - FREE tier: 100k requests/day
// 2 modes: IP collection (FiveM API) + Resource scan (direct, NO RATE LIMIT!)

interface Env {
  API_BASE: string
}

interface ServerWithIp {
  id: string
  ip: string
  players: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK')
    }

    // MODE 1: Collect IPs from FiveM API (rate limited)
    if (url.pathname === '/collect-ips') {
      try {
        const batchRes = await fetch(`${env.API_BASE}/api/worker/get-batch`)
        const batch = await batchRes.json() as { serverIds: string[], progress: number }

        if (!batch.serverIds?.length) {
          return Response.json({ message: 'No servers to process', progress: batch.progress })
        }

        const results: Record<string, string> = {}
        const promises = batch.serverIds.map(async (serverId: string) => {
          try {
            const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
              headers: { 'User-Agent': 'Mozilla/5.0' }
            })
            if (res.ok) {
              const data = await res.json() as { Data?: { connectEndPoints?: string[] } }
              const ip = data.Data?.connectEndPoints?.[0]
              if (ip) results[serverId] = ip
            }
          } catch { /* skip */ }
        })

        await Promise.all(promises)

        if (Object.keys(results).length > 0) {
          await fetch(`${env.API_BASE}/api/worker/submit-ips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results, workerId: 'cloudflare' })
          })
        }

        return Response.json({
          mode: 'collect-ips',
          processed: batch.serverIds.length,
          success: Object.keys(results).length,
          progress: batch.progress
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // MODE 2: Scan resources directly from servers (NO RATE LIMIT!)
    if (url.pathname === '/scan') {
      try {
        // Get servers with IPs
        const serversRes = await fetch(`${env.API_BASE}/api/servers-with-ips`)
        const servers = await serversRes.json() as ServerWithIp[]

        if (!servers?.length) {
          return Response.json({ message: 'No servers with IPs yet' })
        }

        // Scan all servers directly (parallel, no rate limit)
        const results: Array<{ serverId: string, resources: string[], players: number }> = []
        const startTime = Date.now()

        // Process in batches of 100 to avoid timeout
        const BATCH_SIZE = 100
        for (let i = 0; i < servers.length; i += BATCH_SIZE) {
          const batch = servers.slice(i, i + BATCH_SIZE)
          const promises = batch.map(async (server) => {
            try {
              const controller = new AbortController()
              const timeout = setTimeout(() => controller.abort(), 3000)
              const res = await fetch(`http://${server.ip}/info.json`, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Mozilla/5.0' }
              })
              clearTimeout(timeout)
              if (res.ok) {
                const data = await res.json() as { resources?: string[] }
                if (data.resources?.length) {
                  results.push({ serverId: server.id, resources: data.resources, players: server.players })
                }
              }
            } catch { /* server offline */ }
          })
          await Promise.all(promises)
        }

        // Submit results
        if (results.length > 0) {
          await fetch(`${env.API_BASE}/api/scan/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results })
          })
        }

        return Response.json({
          mode: 'scan',
          totalServers: servers.length,
          online: results.length,
          timeMs: Date.now() - startTime
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    // RAPID MODE: Run multiple IP collection rounds in parallel
    if (url.pathname === '/rapid') {
      const rounds = parseInt(url.searchParams.get('rounds') || '5')
      const promises = Array(rounds).fill(null).map(async (_, i) => {
        await new Promise(r => setTimeout(r, i * 200)) // Stagger by 200ms
        try {
          const res = await fetch(`${env.API_BASE}/api/worker/get-batch`)
          const batch = await res.json() as { serverIds: string[], progress: number }
          if (!batch.serverIds?.length) return { round: i, success: 0, total: 0 }

          const results: Record<string, string> = {}
          const fetchPromises = batch.serverIds.map(async (serverId: string) => {
            try {
              const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              })
              if (r.ok) {
                const data = await r.json() as { Data?: { connectEndPoints?: string[] } }
                const ip = data.Data?.connectEndPoints?.[0]
                if (ip) results[serverId] = ip
              }
            } catch { /* skip */ }
          })
          await Promise.all(fetchPromises)

          if (Object.keys(results).length > 0) {
            await fetch(`${env.API_BASE}/api/worker/submit-ips`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ results, workerId: `cloudflare-rapid-${i}` })
            })
          }
          return { round: i, success: Object.keys(results).length, total: batch.serverIds.length }
        } catch {
          return { round: i, success: 0, total: 0, error: true }
        }
      })

      const results = await Promise.all(promises)
      const totalSuccess = results.reduce((sum, r) => sum + r.success, 0)
      const totalProcessed = results.reduce((sum, r) => sum + r.total, 0)

      return Response.json({
        mode: 'rapid',
        rounds,
        totalSuccess,
        totalProcessed,
        details: results
      })
    }

    return Response.json({
      endpoints: [
        '/collect-ips - Collect IPs from FiveM API (rate limited)',
        '/scan - Scan resources directly from servers (NO RATE LIMIT!)',
        '/rapid?rounds=5 - Run multiple IP collection rounds',
        '/health - Health check'
      ]
    })
  },

  // Cron: Collect IPs continuously
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      fetch(new URL('/rapid?rounds=3', env.API_BASE))
    )
  }
}
