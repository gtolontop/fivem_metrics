// Worker script - run this on multiple Railway instances
// Each instance has different IP = no FiveM rate limit!

const API_BASE = process.env.API_BASE || 'http://localhost:3005'
const WORKER_ID = process.env.WORKER_ID || `worker-${Math.random().toString(36).slice(2, 8)}`

async function fetchIpForServer(serverId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const endpoints = data.Data?.connectEndPoints
    return endpoints?.[0] || null
  } catch {
    return null
  }
}

async function runWorker() {
  console.log(`[${WORKER_ID}] Starting worker...`)
  console.log(`[${WORKER_ID}] API: ${API_BASE}`)

  let totalProcessed = 0
  let totalSuccess = 0

  while (true) {
    try {
      // 1. Get batch of servers to process
      const batchRes = await fetch(`${API_BASE}/api/worker/get-batch?worker=${WORKER_ID}`)
      const batch = await batchRes.json()

      if (!batch.serverIds || batch.serverIds.length === 0) {
        console.log(`[${WORKER_ID}] No more servers to process. Progress: ${batch.progress}%`)
        if (batch.progress >= 100) {
          console.log(`[${WORKER_ID}] All done! Total: ${batch.total} servers`)
          break
        }
        // Wait and retry
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      console.log(`[${WORKER_ID}] Processing ${batch.serverIds.length} servers... (${batch.progress}% done)`)

      // 2. Fetch IPs in parallel
      const results: Record<string, string> = {}
      const promises = batch.serverIds.map(async (serverId: string) => {
        const ip = await fetchIpForServer(serverId)
        if (ip) {
          results[serverId] = ip
        }
      })

      await Promise.all(promises)

      const successCount = Object.keys(results).length
      console.log(`[${WORKER_ID}] Got ${successCount}/${batch.serverIds.length} IPs`)

      // 3. Submit results
      if (successCount > 0) {
        const submitRes = await fetch(`${API_BASE}/api/worker/submit-ips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ results, workerId: WORKER_ID })
        })
        const submitData = await submitRes.json()
        console.log(`[${WORKER_ID}] Submitted. Total IPs: ${submitData.total}`)
      }

      totalProcessed += batch.serverIds.length
      totalSuccess += successCount

      // Small delay to avoid hammering
      await new Promise(r => setTimeout(r, 1000))

    } catch (error) {
      console.error(`[${WORKER_ID}] Error:`, error)
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  console.log(`[${WORKER_ID}] Finished. Processed: ${totalProcessed}, Success: ${totalSuccess}`)
}

runWorker()
