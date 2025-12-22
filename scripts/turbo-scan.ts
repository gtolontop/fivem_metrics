// TURBO SCAN - Run locally, parallel requests
// Usage: API_BASE=http://localhost:3005 npx tsx scripts/turbo-scan.ts

const API_BASE = process.env.API_BASE || 'http://localhost:3005'
const PARALLEL_BATCHES = 10 // 10 batches en parallèle
const DELAY_BETWEEN_ROUNDS = 2000 // 2 sec entre chaque round

async function fetchBatchAndProcess(): Promise<{ success: number, total: number }> {
  try {
    // Get batch
    const batchRes = await fetch(`${API_BASE}/api/worker/get-batch`)
    const batch = await batchRes.json() as { serverIds: string[], progress: number }

    if (!batch.serverIds || batch.serverIds.length === 0) {
      return { success: 0, total: 0 }
    }

    // Fetch IPs
    const results: Record<string, string> = {}

    const promises = batch.serverIds.map(async (serverId: string) => {
      try {
        const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        })
        if (res.ok) {
          const data = await res.json()
          const ip = data.Data?.connectEndPoints?.[0]
          if (ip) results[serverId] = ip
        }
      } catch { /* skip */ }
    })

    await Promise.all(promises)

    // Submit
    if (Object.keys(results).length > 0) {
      await fetch(`${API_BASE}/api/worker/submit-ips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, workerId: 'turbo' })
      })
    }

    return { success: Object.keys(results).length, total: batch.serverIds.length }
  } catch {
    return { success: 0, total: 0 }
  }
}

async function getStatus(): Promise<{ progress: number, remaining: number }> {
  try {
    const res = await fetch(`${API_BASE}/api/status`)
    const data = await res.json() as { servers: { withIp: number, total: number } }
    const progress = Math.round((data.servers.withIp / data.servers.total) * 100)
    return { progress, remaining: data.servers.total - data.servers.withIp }
  } catch {
    return { progress: 0, remaining: 0 }
  }
}

async function main() {
  console.log('🚀 TURBO SCAN - Parallel IP Fetcher')
  console.log(`📡 API: ${API_BASE}`)
  console.log(`⚡ Running ${PARALLEL_BATCHES} parallel batches\n`)

  let totalSuccess = 0
  let round = 0

  while (true) {
    round++
    const status = await getStatus()
    console.log(`\n📊 Round ${round} | Progress: ${status.progress}% | Remaining: ${status.remaining}`)

    if (status.remaining === 0) {
      console.log('\n✅ All done!')
      break
    }

    // Run parallel batches
    const startTime = Date.now()
    const batchPromises = Array(PARALLEL_BATCHES).fill(null).map(() => fetchBatchAndProcess())
    const results = await Promise.all(batchPromises)

    const roundSuccess = results.reduce((sum, r) => sum + r.success, 0)
    const roundTotal = results.reduce((sum, r) => sum + r.total, 0)
    totalSuccess += roundSuccess

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`   ✓ Got ${roundSuccess}/${roundTotal} IPs in ${elapsed}s (Total: ${totalSuccess})`)

    if (roundTotal === 0) {
      console.log('   ⏳ Rate limited, waiting 10s...')
      await new Promise(r => setTimeout(r, 10000))
    } else {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_ROUNDS))
    }
  }
}

main()
