// Cloudflare Worker - FREE tier: 100k requests/day
// Deploy sur Cloudflare, appelle ton API Railway

interface Env {
  API_BASE: string // ton app Railway
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Health check
    if (url.pathname === '/health') {
      return new Response('OK')
    }

    // Process batch
    if (url.pathname === '/process') {
      try {
        // 1. Get batch from main app
        const batchRes = await fetch(`${env.API_BASE}/api/worker/get-batch`)
        const batch = await batchRes.json() as { serverIds: string[], progress: number }

        if (!batch.serverIds || batch.serverIds.length === 0) {
          return Response.json({ message: 'No servers to process', progress: batch.progress })
        }

        // 2. Fetch IPs in parallel (Cloudflare allows this!)
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
          } catch {
            // Skip failed
          }
        })

        await Promise.all(promises)

        // 3. Submit results to main app
        if (Object.keys(results).length > 0) {
          await fetch(`${env.API_BASE}/api/worker/submit-ips`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results, workerId: 'cloudflare' })
          })
        }

        return Response.json({
          processed: batch.serverIds.length,
          success: Object.keys(results).length,
          progress: batch.progress
        })
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 500 })
      }
    }

    return new Response('Use /process to run', { status: 404 })
  },

  // Cron trigger - run every minute for FREE
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Call /process endpoint
    await fetch(`https://your-worker.workers.dev/process`)
  }
}
