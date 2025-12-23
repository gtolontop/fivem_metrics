/**
 * Background IP Fetcher - Runs on Railway
 * Fetches IPs from FiveM API with rate limit handling
 *
 * NOTE: FiveM rate limits aggressively (~100-150 requests then blocks)
 * We use exponential backoff when rate limited
 */

import { getWorkerBatch, submitIpResults, getQueueStats, isQueueEnabled, IpResult } from './queue'

let isRunning = false
let shouldStop = false
let currentBackoff = 5000  // Start with 5s delay
const MIN_BACKOFF = 5000   // Minimum 5s between batches
const MAX_BACKOFF = 60000  // Max 60s when rate limited

// Conservative settings to avoid rate limits
const BATCH_SIZE = 30      // Small batches
const CONCURRENT = 10      // Only 10 concurrent

async function fetchIp(serverId: string): Promise<IpResult> {
  try {
    const res = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${serverId}`, {
      signal: AbortSignal.timeout(10000),
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
  } catch {
    return { serverId, ip: null, error: 'timeout' }
  }
}

async function runContinuousFetch(): Promise<void> {
  if (isRunning || !isQueueEnabled()) return

  isRunning = true
  shouldStop = false

  console.log(`[BG-IP] Starting (${BATCH_SIZE} batch, ${CONCURRENT} concurrent, ${MIN_BACKOFF}ms min delay)`)

  while (!shouldStop) {
    try {
      const stats = await getQueueStats()

      if (stats.pendingIpFetch === 0) {
        console.log('[BG-IP] Queue empty, waiting...')
        await new Promise(r => setTimeout(r, 30000))
        continue
      }

      // Get small batch
      const tasks = await getWorkerBatch('railway-ip-fetcher', 'ip_fetch', BATCH_SIZE)
      const ipTasks = tasks.filter(t => t.type === 'ip_fetch')

      if (ipTasks.length === 0) {
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      // Fetch with concurrency limit
      const results: IpResult[] = []
      for (let i = 0; i < ipTasks.length; i += CONCURRENT) {
        const batch = ipTasks.slice(i, i + CONCURRENT)
        const batchResults = await Promise.all(batch.map(t => fetchIp(t.serverId)))
        results.push(...batchResults)

        // Delay between sub-batches
        if (i + CONCURRENT < ipTasks.length) {
          await new Promise(r => setTimeout(r, 500))
        }
      }

      // Submit results
      const { success, failed } = await submitIpResults(results)

      // Check for rate limiting
      const rateLimited = results.filter(r => r.error === 'rate_limited').length
      const successRate = results.length > 0 ? success / results.length : 0

      if (rateLimited > 0 || successRate < 0.5) {
        // Increase backoff when rate limited
        currentBackoff = Math.min(currentBackoff * 2, MAX_BACKOFF)
        console.log(`[BG-IP] Rate limited! Backing off to ${currentBackoff / 1000}s`)
      } else if (success > 0) {
        // Decrease backoff on success
        currentBackoff = Math.max(currentBackoff * 0.8, MIN_BACKOFF)
      }

      console.log(`[BG-IP] ${success}/${results.length} success, ${stats.pendingIpFetch} pending, next in ${(currentBackoff/1000).toFixed(0)}s`)

      // Wait before next batch
      await new Promise(r => setTimeout(r, currentBackoff))

    } catch (e) {
      console.error('[BG-IP] Error:', e)
      await new Promise(r => setTimeout(r, 10000))
    }
  }

  isRunning = false
  console.log('[BG-IP] Stopped')
}

export function startBackgroundIpFetcher() {
  if (isRunning) return
  runContinuousFetch()
}

export function stopBackgroundIpFetcher() {
  shouldStop = true
  console.log('[BG-IP] Stop requested')
}

// For backwards compatibility
async function runIpFetchBatch(): Promise<{ fetched: number, success: number }> {
  if (!isRunning) startBackgroundIpFetcher()
  return { fetched: 0, success: 0 }
}

export { runIpFetchBatch }
