/**
 * Background IP Fetcher - Runs on Railway
 * Fetches IPs from FiveM API in parallel batches
 */

import { getWorkerBatch, submitIpResults, getQueueStats, isQueueEnabled, IpResult } from './queue'

let isFetching = false
let fetchInterval: ReturnType<typeof setInterval> | null = null

// FiveM API has rate limits, but we can do ~100 concurrent requests
const BATCH_SIZE = 100           // Get 100 tasks at a time from queue
const CONCURRENT_REQUESTS = 50   // Execute 50 concurrently (then next 50)
const DELAY_BETWEEN_BATCHES = 3000 // 3 seconds between batches to avoid rate limit

async function fetchIp(serverId: string): Promise<IpResult> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    clearTimeout(timeout)

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
    return { serverId, ip: null, error: e instanceof Error ? e.message : 'unknown' }
  }
}

async function runIpFetchBatch(): Promise<{ fetched: number, success: number }> {
  if (isFetching || !isQueueEnabled()) return { fetched: 0, success: 0 }

  isFetching = true

  try {
    // Get batch of servers to fetch IPs for (100 at a time for Railway)
    const tasks = await getWorkerBatch('railway-ip-fetcher', 'ip_fetch', BATCH_SIZE)

    if (tasks.length === 0) {
      return { fetched: 0, success: 0 }
    }

    // Filter only ip_fetch tasks
    const ipTasks = tasks.filter(t => t.type === 'ip_fetch')

    if (ipTasks.length === 0) {
      return { fetched: 0, success: 0 }
    }

    // Fetch in parallel with concurrency limit
    const results: IpResult[] = []

    for (let i = 0; i < ipTasks.length; i += CONCURRENT_REQUESTS) {
      const batch = ipTasks.slice(i, i + CONCURRENT_REQUESTS)
      const batchResults = await Promise.all(
        batch.map(t => fetchIp(t.serverId))
      )
      results.push(...batchResults)

      // Small delay between sub-batches to avoid rate limiting
      if (i + CONCURRENT_REQUESTS < ipTasks.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Submit results
    const { success } = await submitIpResults(results)

    console.log(`[BG-IP] Fetched ${results.length}, success: ${success}`)
    return { fetched: results.length, success }

  } catch (e) {
    console.error('[BG-IP] Error:', e)
    return { fetched: 0, success: 0 }
  } finally {
    isFetching = false
  }
}

export function startBackgroundIpFetcher() {
  if (fetchInterval) return

  console.log('[BG-IP] Starting background IP fetcher')

  // Run every 3 seconds (aggressive but with rate limit handling)
  fetchInterval = setInterval(async () => {
    const stats = await getQueueStats()
    if (stats.pendingIpFetch > 0) {
      await runIpFetchBatch()
    }
  }, DELAY_BETWEEN_BATCHES)

  // Run immediately
  runIpFetchBatch()
}

export function stopBackgroundIpFetcher() {
  if (fetchInterval) {
    clearInterval(fetchInterval)
    fetchInterval = null
    console.log('[BG-IP] Stopped')
  }
}

export { runIpFetchBatch }
